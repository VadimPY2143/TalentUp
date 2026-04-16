import asyncio
import logging
import os
from typing import Any, Coroutine, TypeVar

import redis.asyncio as redis
from redis.exceptions import RedisError
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from payments.billing import CreditBillingService
from employer.candidate_matching.ai_rerank import rerank_candidate
from employer.candidate_matching.cache import (
    build_job_payload,
    dumps_payload,
    loads_payload,
    match_job_key,
    match_latest_job_key,
    utcnow_iso,
)
from employer.candidate_matching.repository import CandidateMatchingRepository
from worker.messages.celery_app import celery_app

LOGGER = logging.getLogger(__name__)
_T = TypeVar("_T")
billing_service = CreditBillingService()

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
MATCH_CACHE_TTL_SECONDS = 3600
AI_CONCURRENCY = 2

POSTGRES_USER = os.getenv('POSTGRES_USER')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD')
POSTGRES_HOST = os.getenv('POSTGRES_HOST')
POSTGRES_PORT = os.getenv('POSTGRES_PORT')
POSTGRES_DB = os.getenv('POSTGRES_DB')

CELERY_DATABASE_URL = (
    f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
    f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)


def _run_async(coro: Coroutine[object, object, _T]) -> _T:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.run_until_complete(loop.shutdown_asyncgens())
        loop.close()


async def _get_redis_client():
    return redis.from_url(REDIS_URL, decode_responses=True)


async def _get_celery_session() -> AsyncSession:
    engine = create_async_engine(
        CELERY_DATABASE_URL,
        echo=False,
        pool_size=1,
        max_overflow=0,
        pool_pre_ping=False,
        pool_recycle=300,
    )
    session_factory = async_sessionmaker(
        bind=engine,
        expire_on_commit=False,
    )
    return session_factory()


def _normalize_work_formats(values: list[str] | None) -> set[str]:
    if not values:
        return set()

    normalized: set[str] = set()
    for value in values:
        token = value.strip().lower().replace("-", "").replace("_", "").replace(" ", "")
        if token == "remote":
            normalized.add("Remote")
        elif token == "hybrid":
            normalized.add("Hybrid")
        elif token in {"office", "onsite", "offline"}:
            normalized.add("Office")
    return normalized


def _heuristic_score(vacancy: dict[str, Any], candidate: dict[str, Any]) -> int:
    score = 45

    vacancy_min_exp = vacancy.get("experience_years_min")
    candidate_exp = candidate.get("years_experience")
    if vacancy_min_exp is not None and candidate_exp is not None:
        score += 12 if int(candidate_exp) >= int(vacancy_min_exp) else -8

    vacancy_salary_min = vacancy.get("salary_min")
    vacancy_salary_max = vacancy.get("salary_max")
    candidate_salary_min = candidate.get("salary_min")
    candidate_salary_max = candidate.get("salary_max")
    if vacancy_salary_min is not None or vacancy_salary_max is not None:
        lower = vacancy_salary_min if vacancy_salary_min is not None else vacancy_salary_max
        upper = vacancy_salary_max if vacancy_salary_max is not None else vacancy_salary_min
        cand_low = candidate_salary_min if candidate_salary_min is not None else candidate_salary_max
        cand_high = candidate_salary_max if candidate_salary_max is not None else candidate_salary_min
        if cand_low is not None and cand_high is not None and lower is not None and upper is not None:
            overlaps = cand_low <= upper and cand_high >= lower
            score += 10 if overlaps else -5

    vacancy_formats = _normalize_work_formats(
        list(vacancy.get("work_format") or []) + list(vacancy.get("employment_type") or [])
    )
    candidate_formats = _normalize_work_formats(candidate.get("employment_type"))
    if vacancy_formats and candidate_formats:
        if vacancy_formats.intersection(candidate_formats):
            score += 8
        else:
            score -= 6

    if "Remote" not in vacancy_formats and vacancy.get("city_id") and candidate.get("city_id"):
        score += 8 if vacancy["city_id"] == candidate["city_id"] else -4

    title = str(vacancy.get("title") or "").lower()
    desired_role = str(candidate.get("desired_role") or "").lower()
    if title and desired_role and (title in desired_role or desired_role in title):
        score += 8

    return max(0, min(100, int(score)))


async def _store_payload(payload: dict[str, Any]) -> None:
    try:
        client = await _get_redis_client()
        await client.set(
            match_job_key(payload["job_id"]),
            dumps_payload(payload),
            ex=MATCH_CACHE_TTL_SECONDS,
        )
        await client.set(
            match_latest_job_key(payload["vacancy_id"], payload["created_by_user_id"]),
            payload["job_id"],
            ex=MATCH_CACHE_TTL_SECONDS,
        )
        await client.close()
    except RedisError:
        return


async def _mark_job_failed(
    *,
    job_id: str,
    vacancy_id: int,
    employer_user_id: int,
    requested_limit: int,
    error: str,
) -> None:
    payload: dict[str, Any] | None = None
    try:
        client = await _get_redis_client()
        raw = await client.get(match_job_key(job_id))
        payload = loads_payload(raw)
        await client.close()
    except RedisError:
        payload = None

    if payload is None:
        payload = build_job_payload(
            job_id=job_id,
            vacancy_id=vacancy_id,
            created_by_user_id=employer_user_id,
            status="failed",
            requested_limit=requested_limit,
        )

    payload["status"] = "failed"
    payload["updated_at"] = utcnow_iso()
    payload["error"] = error[:500]
    await _store_payload(payload)


async def _refund_candidate_matching_credits(
    *,
    employer_user_id: int,
    vacancy_id: int,
    job_id: str,
    amount: int,
    reason: str,
) -> None:
    if amount <= 0:
        return

    session = await _get_celery_session()
    try:
        async with session.begin():
            await billing_service.refund_feature_charge(
                session=session,
                user_id=employer_user_id,
                amount=amount,
                idempotency_key=f"refund:{job_id}",
                feature_code="candidate_matching",
                reference_type="matching_job",
                reference_id=job_id,
                meta={
                    "reason": reason,
                    "vacancy_id": vacancy_id,
                },
            )
    finally:
        await session.close()
        if hasattr(session, 'bind') and hasattr(session.bind, 'dispose'):
            await session.bind.dispose()


async def _set_status(
    *,
    payload: dict[str, Any],
    status: str,
    prefiltered_count: int | None = None,
    scored_count: int | None = None,
    error: str | None = None,
    result: list[dict[str, Any]] | None = None,
) -> None:
    payload["status"] = status
    payload["updated_at"] = utcnow_iso()
    if prefiltered_count is not None:
        payload["prefiltered_count"] = prefiltered_count
    if scored_count is not None:
        payload["scored_count"] = scored_count
    if error is not None:
        payload["error"] = error
    if result is not None:
        payload["result"] = result
    await _store_payload(payload)


async def _score_single_candidate(
    *,
    vacancy: dict[str, Any],
    candidate: dict[str, Any],
    sql_score: int,
) -> dict[str, Any]:
    try:
        ai_result = await rerank_candidate(vacancy, candidate)
        score_total = max(0, min(100, int(round((ai_result.score_total * 0.7) + (sql_score * 0.3)))))
        return {
            "score_total": score_total,
            "confidence": float(ai_result.confidence),
            "verdict": ai_result.verdict,
            "matched_skills": ai_result.matched_skills,
            "missing_skills": ai_result.missing_skills,
            "strengths": ai_result.strengths,
            "risks": ai_result.risks,
            "summary": ai_result.summary,
        }
    except Exception:
        return {
            "score_total": sql_score,
            "confidence": 0.3,
            "verdict": "weak_match" if sql_score >= 50 else "mismatch",
            "matched_skills": [],
            "missing_skills": [],
            "strengths": [],
            "risks": ["AI scoring temporarily unavailable"],
            "summary": "Тимчасово недоступна повна AI-оцінка, тому використано спрощений розрахунок релевантності.",
        }


@celery_app.task(
    name="employer.candidate_matching.tasks.run_candidate_matching",
    bind=True,
)
def run_candidate_matching(
    self,
    *,
    job_id: str,
    vacancy_id: int,
    employer_user_id: int,
    requested_limit: int,
    charged_credits: int,
    **_unused: Any,
) -> dict[str, Any]:
    del self
    try:
        return _run_async(
            _run_candidate_matching(
                job_id=job_id,
                vacancy_id=vacancy_id,
                employer_user_id=employer_user_id,
                requested_limit=requested_limit,
                charged_credits=charged_credits,
            )
        )
    except Exception as exc:
        error_message = f"Candidate matching failed: {exc}"
        LOGGER.exception(
            "Candidate matching crashed for vacancy_id=%s, employer_user_id=%s, job_id=%s",
            vacancy_id,
            employer_user_id,
            job_id,
        )
        try:
            _run_async(
                _mark_job_failed(
                    job_id=job_id,
                    vacancy_id=vacancy_id,
                    employer_user_id=employer_user_id,
                    requested_limit=requested_limit,
                    error=error_message,
                )
            )
        except Exception:
            LOGGER.exception("Failed to persist failed status for candidate matching job_id=%s", job_id)
        try:
            _run_async(
                _refund_candidate_matching_credits(
                    employer_user_id=employer_user_id,
                    vacancy_id=vacancy_id,
                    job_id=job_id,
                    amount=charged_credits,
                    reason="task_failed",
                )
            )
        except Exception:
            LOGGER.exception("Failed to refund credits for candidate matching job_id=%s", job_id)
        raise


async def _run_candidate_matching(
    *,
    job_id: str,
    vacancy_id: int,
    employer_user_id: int,
    requested_limit: int,
    charged_credits: int,
) -> dict[str, Any]:
    payload = build_job_payload(
        job_id=job_id,
        vacancy_id=vacancy_id,
        created_by_user_id=employer_user_id,
        status="running",
        requested_limit=requested_limit,
    )
    await _store_payload(payload)

    repository = CandidateMatchingRepository()
    session = await _get_celery_session()
    try:
        async with session.begin():
            vacancy = await repository.get_owned_vacancy(
                session=session,
                vacancy_id=vacancy_id,
                employer_user_id=employer_user_id,
            )
            if vacancy is None:
                await _set_status(payload=payload, status="failed", error="Vacancy not found")
                await _refund_candidate_matching_credits(
                    employer_user_id=employer_user_id,
                    vacancy_id=vacancy_id,
                    job_id=job_id,
                    amount=charged_credits,
                    reason="vacancy_not_found",
                )
                return payload

            candidates = await repository.list_vacancy_candidates(
                session=session,
                vacancy=vacancy,
            )
    finally:
        await session.close()
        if hasattr(session, 'bind') and hasattr(session.bind, 'dispose'):
            await session.bind.dispose()

    if not candidates:
        await _set_status(
            payload=payload,
            status="done",
            prefiltered_count=0,
            scored_count=0,
            result=[],
        )
        return payload

    await _set_status(
        payload=payload,
        status="running",
        prefiltered_count=len(candidates),
        scored_count=0,
    )

    semaphore = asyncio.Semaphore(max(AI_CONCURRENCY, 1))

    async def _score_row(row: dict[str, Any]) -> dict[str, Any]:
        sql_score = _heuristic_score(vacancy, row)
        async with semaphore:
            await asyncio.sleep(0.3)  # затримка між запитами для стабільності
            ai_payload = await _score_single_candidate(vacancy=vacancy, candidate=row, sql_score=sql_score)
        merged = {
            "application_id": int(row["application_id"]),
            "resume_id": int(row["resume_id"]),
            "candidate_user_id": int(row["candidate_user_id"]),
            "candidate_name": str(row.get("candidate_name") or "Unknown"),
            "title": str(row.get("resume_title") or "Resume"),
            "desired_role": row.get("desired_role"),
            "years_experience": row.get("years_experience"),
            "location": row.get("location"),
            "employment_type": list(row.get("employment_type") or []),
            "salary_min": row.get("salary_min"),
            "salary_max": row.get("salary_max"),
            "salary_currency": row.get("salary_currency"),
            "cover_letter": row.get("cover_letter"),
            "score_sql": sql_score,
            **ai_payload,
        }
        return merged

    scored_rows = await asyncio.gather(*[_score_row(candidate) for candidate in candidates])
    scored_rows = sorted(
        scored_rows,
        key=lambda row: (row["score_total"], row["confidence"], row["score_sql"]),
        reverse=True,
    )

    top_rows: list[dict[str, Any]] = []
    for index, row in enumerate(scored_rows[:requested_limit], start=1):
        top_rows.append({"rank": index, **row})

    await _set_status(
        payload=payload,
        status="done",
        prefiltered_count=len(candidates),
        scored_count=len(scored_rows),
        result=top_rows,
    )
    return payload
