import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

sys.path.append(str(Path(__file__).resolve().parents[1]))

import employer.candidate_matching.ai_rerank as ai_rerank
import employer.candidate_matching.tasks as matching_tasks
from employer.candidate_matching.models import (
    CandidateBatchRerankItem,
    CandidateBatchRerankOutput,
    CandidateRerankOutput,
)


class _AgentStub:
    def __init__(self, output: CandidateBatchRerankOutput) -> None:
        self._output = output
        self.calls: list[dict[str, object]] = []

    async def run(self, prompt: str, output_type: object, model_settings: dict[str, object]) -> SimpleNamespace:
        self.calls.append(
            {
                "prompt": prompt,
                "output_type": output_type,
                "model_settings": model_settings,
            }
        )
        return SimpleNamespace(output=self._output)


class _SlowAgentStub:
    async def run(self, prompt: str, output_type: object, model_settings: dict[str, object]) -> SimpleNamespace:
        del prompt, output_type, model_settings
        await asyncio.sleep(0.02)
        return SimpleNamespace(output=CandidateBatchRerankOutput(results=[]))


class _SessionBeginStub:
    async def __aenter__(self) -> None:
        return None

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        del exc_type, exc, tb
        return False


class _SessionStub:
    def __init__(self) -> None:
        self.bind = SimpleNamespace(dispose=AsyncMock())
        self.closed = False

    def begin(self) -> _SessionBeginStub:
        return _SessionBeginStub()

    async def close(self) -> None:
        self.closed = True


class _RepositoryStub:
    def __init__(
        self,
        vacancy: dict[str, object],
        candidates: list[dict[str, object]],
        cached_rows: list[dict[str, object]] | None = None,
    ) -> None:
        self._vacancy = vacancy
        self._candidates = candidates
        self._cached_rows = cached_rows or []
        self.upsert_calls: list[dict[str, object]] = []

    async def get_owned_vacancy(
        self,
        session: object,
        vacancy_id: int,
        employer_user_id: int,
    ) -> dict[str, object] | None:
        del session, vacancy_id, employer_user_id
        return self._vacancy

    async def list_vacancy_candidates(
        self,
        session: object,
        *,
        vacancy: dict[str, object],
    ) -> list[dict[str, object]]:
        del session, vacancy
        return list(self._candidates)

    async def get_cached_ai_results(
        self,
        session: object,
        *,
        vacancy_id: int,
        vacancy_signature: str,
        application_ids: list[int],
    ) -> list[dict[str, object]]:
        del session, vacancy_id
        allowed_ids = set(application_ids)
        return [
            row
            for row in self._cached_rows
            if int(row["application_id"]) in allowed_ids
            and str(row.get("vacancy_signature") or vacancy_signature) == vacancy_signature
        ]

    async def upsert_cached_ai_results(
        self,
        session: object,
        *,
        vacancy_id: int,
        vacancy_signature: str,
        model_name: str,
        cache_rows: list[dict[str, object]],
    ) -> None:
        del session
        self.upsert_calls.append(
            {
                "vacancy_id": vacancy_id,
                "vacancy_signature": vacancy_signature,
                "model_name": model_name,
                "cache_rows": list(cache_rows),
            }
        )


def _build_candidate(application_id: int, score_sql_hint: int) -> dict[str, object]:
    return {
        "application_id": application_id,
        "resume_id": 1000 + application_id,
        "candidate_user_id": 2000 + application_id,
        "candidate_name": f"Candidate {application_id}",
        "resume_title": "Python Developer",
        "desired_role": "Python Developer",
        "resume_summary": "FastAPI, PostgreSQL, Docker",
        "years_experience": 3,
        "location": "Kyiv",
        "employment_type": ["Full-time", "Remote"],
        "salary_min": 1500,
        "salary_max": 2500,
        "salary_currency": "USD",
        "cover_letter": "Motivated candidate",
        "score_sql_hint": score_sql_hint,
    }


def _build_vacancy() -> dict[str, object]:
    return {
        "id": 55,
        "title": "Python Developer",
        "description": "Backend role",
        "requirements": "FastAPI, PostgreSQL",
        "responsibilities": "Build APIs",
        "employment_type": ["Full-time"],
        "work_format": ["Remote"],
        "experience_years_min": 2,
    }


def _install_common_task_stubs(
    monkeypatch: pytest.MonkeyPatch,
    vacancy: dict[str, object],
    candidates: list[dict[str, object]],
    *,
    cached_rows: list[dict[str, object]] | None = None,
) -> tuple[AsyncMock, AsyncMock]:
    repository_stub = _RepositoryStub(vacancy=vacancy, candidates=candidates, cached_rows=cached_rows)
    charge_mock = AsyncMock(return_value=4)
    refund_mock = AsyncMock()
    monkeypatch.setattr(matching_tasks, "CandidateMatchingRepository", lambda: repository_stub)
    monkeypatch.setattr(matching_tasks, "_get_celery_session", AsyncMock(return_value=_SessionStub()))
    monkeypatch.setattr(matching_tasks, "_store_payload", AsyncMock())
    monkeypatch.setattr(matching_tasks, "_charge_candidate_matching_credits", charge_mock)
    monkeypatch.setattr(matching_tasks, "_refund_candidate_matching_credits", refund_mock)
    monkeypatch.setattr(
        matching_tasks,
        "_heuristic_score",
        lambda _vacancy, candidate: int(candidate["score_sql_hint"]),
    )
    return charge_mock, refund_mock


@pytest.mark.asyncio
async def test_rerank_candidates_filters_unknown_ids_and_keeps_first_duplicate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    candidates = [
        _build_candidate(application_id=11, score_sql_hint=45),
        _build_candidate(application_id=22, score_sql_hint=60),
    ]
    batch_output = CandidateBatchRerankOutput(
        results=[
            CandidateBatchRerankItem(
                application_id=11,
                score_total=95,
                confidence=0.92,
                verdict="strong_match",
                matched_skills=["Python"],
                missing_skills=[],
                strengths=["Strong backend profile"],
                risks=[],
                summary="Candidate strongly matches the vacancy requirements.",
            ),
            CandidateBatchRerankItem(
                application_id=11,
                score_total=10,
                confidence=0.2,
                verdict="mismatch",
                matched_skills=[],
                missing_skills=["FastAPI"],
                strengths=[],
                risks=["Duplicate should be ignored"],
                summary="Duplicate row should be ignored by parser.",
            ),
            CandidateBatchRerankItem(
                application_id=999,
                score_total=88,
                confidence=0.8,
                verdict="match",
                matched_skills=["Python"],
                missing_skills=[],
                strengths=["Unknown candidate id"],
                risks=[],
                summary="Unknown application id must be ignored.",
            ),
            CandidateBatchRerankItem(
                application_id=22,
                score_total=76,
                confidence=0.7,
                verdict="match",
                matched_skills=["FastAPI"],
                missing_skills=["Redis"],
                strengths=["Relevant stack"],
                risks=["No Redis production cases"],
                summary="Candidate is relevant but has clear skill gaps.",
            ),
        ]
    )
    agent_stub = _AgentStub(output=batch_output)
    monkeypatch.setattr(ai_rerank, "_build_agent", lambda: agent_stub)

    result = await ai_rerank.rerank_candidates(_build_vacancy(), candidates)

    assert set(result.keys()) == {11, 22}
    assert result[11].score_total == 95
    assert result[11].verdict == "strong_match"
    assert result[22].score_total == 76
    assert agent_stub.calls[0]["output_type"] is CandidateBatchRerankOutput


@pytest.mark.asyncio
async def test_rerank_candidates_raises_timeout_error_when_model_is_too_slow(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(ai_rerank, "_build_agent", lambda: _SlowAgentStub())
    monkeypatch.setattr(ai_rerank, "_get_rerank_timeout_seconds", lambda: 0.01)
    with pytest.raises(RuntimeError, match="timed out"):
        await ai_rerank.rerank_candidates(_build_vacancy(), [_build_candidate(application_id=11, score_sql_hint=45)])


@pytest.mark.asyncio
async def test_run_candidate_matching_uses_single_batch_call_for_all_candidates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vacancy = _build_vacancy()
    candidates = [
        _build_candidate(application_id=11, score_sql_hint=40),
        _build_candidate(application_id=22, score_sql_hint=60),
    ]
    charge_mock, refund_mock = _install_common_task_stubs(monkeypatch, vacancy, candidates)

    rerank_mock = AsyncMock(
        return_value={
            11: CandidateRerankOutput(
                score_total=92,
                confidence=0.81,
                verdict="strong_match",
                matched_skills=["Python", "FastAPI"],
                missing_skills=[],
                strengths=["Strong API design"],
                risks=[],
                summary="Strong alignment between experience and role needs.",
            ),
            22: CandidateRerankOutput(
                score_total=70,
                confidence=0.9,
                verdict="match",
                matched_skills=["Python"],
                missing_skills=["Redis"],
                strengths=["Solid backend base"],
                risks=["Limited async production depth"],
                summary="Candidate fits but has several notable gaps.",
            ),
        }
    )
    monkeypatch.setattr(matching_tasks, "rerank_candidates", rerank_mock)

    payload = await matching_tasks._run_candidate_matching(
        job_id="job-1",
        vacancy_id=55,
        employer_user_id=7,
        requested_limit=2,
    )

    assert rerank_mock.await_count == 1
    assert charge_mock.await_count == 1
    assert refund_mock.await_count == 0
    assert payload["status"] == "done"
    assert payload["scored_count"] == 2
    assert payload["result"][0]["application_id"] == 11
    assert payload["result"][0]["score_total"] == 76
    assert payload["result"][1]["application_id"] == 22
    assert payload["result"][1]["score_total"] == 67


@pytest.mark.asyncio
async def test_run_candidate_matching_applies_sql_fallback_for_missing_batch_items(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vacancy = _build_vacancy()
    candidates = [
        _build_candidate(application_id=11, score_sql_hint=80),
        _build_candidate(application_id=22, score_sql_hint=45),
    ]
    _, refund_mock = _install_common_task_stubs(monkeypatch, vacancy, candidates)

    monkeypatch.setattr(
        matching_tasks,
        "rerank_candidates",
        AsyncMock(
            return_value={
                11: CandidateRerankOutput(
                    score_total=80,
                    confidence=0.77,
                    verdict="match",
                    matched_skills=["FastAPI"],
                    missing_skills=["Redis"],
                    strengths=["Good backend focus"],
                    risks=["Needs stronger infrastructure exposure"],
                    summary="Relevant profile with moderate delivery risks.",
                )
            }
        ),
    )

    payload = await matching_tasks._run_candidate_matching(
        job_id="job-2",
        vacancy_id=55,
        employer_user_id=7,
        requested_limit=2,
    )

    assert refund_mock.await_count == 1
    refund_kwargs = refund_mock.await_args.kwargs
    assert refund_kwargs["amount"] == 2
    assert refund_kwargs["reason"] == "partial_ai_results"

    assert payload["status"] == "done"
    by_application_id = {row["application_id"]: row for row in payload["result"]}
    assert by_application_id[11]["score_total"] == 80
    assert by_application_id[22]["score_total"] == 45
    assert by_application_id[22]["confidence"] == 0.3
    assert by_application_id[22]["risks"] == ["AI scoring temporarily unavailable"]


@pytest.mark.asyncio
async def test_run_candidate_matching_uses_sql_fallback_for_all_candidates_on_batch_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vacancy = _build_vacancy()
    candidates = [
        _build_candidate(application_id=11, score_sql_hint=55),
        _build_candidate(application_id=22, score_sql_hint=65),
    ]
    _, refund_mock = _install_common_task_stubs(monkeypatch, vacancy, candidates)

    monkeypatch.setattr(
        matching_tasks,
        "rerank_candidates",
        AsyncMock(side_effect=RuntimeError("model timeout")),
    )

    payload = await matching_tasks._run_candidate_matching(
        job_id="job-3",
        vacancy_id=55,
        employer_user_id=7,
        requested_limit=2,
    )

    assert refund_mock.await_count == 1
    refund_kwargs = refund_mock.await_args.kwargs
    assert refund_kwargs["amount"] == 4
    assert refund_kwargs["reason"] == "partial_ai_results"

    assert payload["status"] == "done"
    assert payload["scored_count"] == 2
    assert all(row["risks"] == ["AI scoring temporarily unavailable"] for row in payload["result"])
    assert {row["score_total"] for row in payload["result"]} == {55, 65}


@pytest.mark.asyncio
async def test_run_candidate_matching_falls_back_to_sql_when_credits_are_insufficient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vacancy = _build_vacancy()
    candidates = [
        _build_candidate(application_id=11, score_sql_hint=55),
        _build_candidate(application_id=22, score_sql_hint=65),
    ]
    _, refund_mock = _install_common_task_stubs(monkeypatch, vacancy, candidates)
    monkeypatch.setattr(
        matching_tasks,
        "_charge_candidate_matching_credits",
        AsyncMock(
            side_effect=HTTPException(
                status_code=402,
                detail={"message": "Not enough credits", "required_credits": 4, "current_credits": 0},
            )
        ),
    )
    rerank_mock = AsyncMock()
    monkeypatch.setattr(matching_tasks, "rerank_candidates", rerank_mock)

    payload = await matching_tasks._run_candidate_matching(
        job_id="job-4",
        vacancy_id=55,
        employer_user_id=7,
        requested_limit=2,
    )

    assert rerank_mock.await_count == 0
    assert refund_mock.await_count == 0
    assert payload["status"] == "done"
    assert {row["score_total"] for row in payload["result"]} == {55, 65}


@pytest.mark.asyncio
async def test_run_candidate_matching_reuses_all_cached_ai_results_without_new_charge(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vacancy = _build_vacancy()
    candidates = [
        _build_candidate(application_id=11, score_sql_hint=60),
        _build_candidate(application_id=22, score_sql_hint=70),
    ]
    app_signature_11 = matching_tasks._build_application_signature(candidates[0])
    app_signature_22 = matching_tasks._build_application_signature(candidates[1])
    cached_rows = [
        {
            "application_id": 11,
            "application_signature": app_signature_11,
            "score_total": 80,
            "verdict": "match",
            "summary": "Cached AI result for candidate 11.",
            "model_name": "openrouter/free",
            "analyzed_at": "2026-05-01T10:00:00+00:00",
        },
        {
            "application_id": 22,
            "application_signature": app_signature_22,
            "score_total": 90,
            "verdict": "strong_match",
            "summary": "Cached AI result for candidate 22.",
            "model_name": "openrouter/free",
            "analyzed_at": "2026-05-01T10:00:00+00:00",
        },
    ]
    charge_mock, refund_mock = _install_common_task_stubs(
        monkeypatch,
        vacancy,
        candidates,
        cached_rows=cached_rows,
    )
    rerank_mock = AsyncMock()
    monkeypatch.setattr(matching_tasks, "rerank_candidates", rerank_mock)

    payload = await matching_tasks._run_candidate_matching(
        job_id="job-5",
        vacancy_id=55,
        employer_user_id=7,
        requested_limit=2,
    )

    assert charge_mock.await_count == 0
    assert rerank_mock.await_count == 0
    assert refund_mock.await_count == 0
    assert payload["status"] == "done"
    by_application_id = {row["application_id"]: row for row in payload["result"]}
    assert by_application_id[11]["score_total"] == 74
    assert by_application_id[22]["score_total"] == 84


@pytest.mark.asyncio
async def test_run_candidate_matching_processes_only_uncached_candidates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vacancy = _build_vacancy()
    candidates = [
        _build_candidate(application_id=11, score_sql_hint=50),
        _build_candidate(application_id=22, score_sql_hint=80),
    ]
    cached_rows = [
        {
            "application_id": 11,
            "application_signature": matching_tasks._build_application_signature(candidates[0]),
            "score_total": 70,
            "verdict": "match",
            "summary": "Cached AI result for candidate 11.",
            "model_name": "openrouter/free",
            "analyzed_at": "2026-05-01T10:00:00+00:00",
        }
    ]
    charge_mock, refund_mock = _install_common_task_stubs(
        monkeypatch,
        vacancy,
        candidates,
        cached_rows=cached_rows,
    )
    rerank_mock = AsyncMock(
        return_value={
            22: CandidateRerankOutput(
                score_total=85,
                confidence=0.8,
                verdict="strong_match",
                matched_skills=["Python"],
                missing_skills=[],
                strengths=["Strong async backend profile"],
                risks=[],
                summary="Fresh AI result for candidate 22.",
            )
        }
    )
    monkeypatch.setattr(matching_tasks, "rerank_candidates", rerank_mock)

    payload = await matching_tasks._run_candidate_matching(
        job_id="job-6",
        vacancy_id=55,
        employer_user_id=7,
        requested_limit=2,
    )

    assert charge_mock.await_count == 1
    assert charge_mock.await_args.kwargs["analyzed_candidates"] == 1
    assert rerank_mock.await_count == 1
    reranked_candidates = rerank_mock.await_args.args[1]
    assert len(reranked_candidates) == 1
    assert reranked_candidates[0]["application_id"] == 22
    assert refund_mock.await_count == 1
    assert refund_mock.await_args.kwargs["amount"] == 2
    assert payload["status"] == "done"


@pytest.mark.asyncio
async def test_run_candidate_matching_ignores_cache_when_vacancy_signature_changed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vacancy = _build_vacancy()
    candidates = [
        _build_candidate(application_id=11, score_sql_hint=52),
        _build_candidate(application_id=22, score_sql_hint=62),
    ]
    cached_rows = [
        {
            "application_id": 11,
            "vacancy_signature": "stale-vacancy-signature",
            "application_signature": matching_tasks._build_application_signature(candidates[0]),
            "score_total": 95,
            "verdict": "strong_match",
            "summary": "Stale cache must not be reused.",
            "model_name": "openrouter/free",
            "analyzed_at": "2026-05-01T10:00:00+00:00",
        }
    ]
    charge_mock, _ = _install_common_task_stubs(
        monkeypatch,
        vacancy,
        candidates,
        cached_rows=cached_rows,
    )
    rerank_mock = AsyncMock(
        return_value={
            11: CandidateRerankOutput(
                score_total=60,
                confidence=0.7,
                verdict="match",
                matched_skills=["Python"],
                missing_skills=[],
                strengths=["Fresh run"],
                risks=[],
                summary="Fresh analysis for candidate 11.",
            ),
            22: CandidateRerankOutput(
                score_total=75,
                confidence=0.7,
                verdict="match",
                matched_skills=["FastAPI"],
                missing_skills=[],
                strengths=["Fresh run"],
                risks=[],
                summary="Fresh analysis for candidate 22.",
            ),
        }
    )
    monkeypatch.setattr(matching_tasks, "rerank_candidates", rerank_mock)

    payload = await matching_tasks._run_candidate_matching(
        job_id="job-7",
        vacancy_id=55,
        employer_user_id=7,
        requested_limit=2,
    )

    assert charge_mock.await_count == 1
    assert charge_mock.await_args.kwargs["analyzed_candidates"] == 2
    assert rerank_mock.await_count == 1
    assert payload["status"] == "done"
