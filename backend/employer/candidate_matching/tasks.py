import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Coroutine, TypeVar

import redis.asyncio as redis
from fastapi import HTTPException
from redis.exceptions import RedisError
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from payments.billing import CreditBillingService, get_candidate_matching_credits
from employer.candidate_matching.ai_rerank import rerank_candidates
from employer.candidate_matching.cache import (
    build_job_payload,
    dumps_payload,
    loads_payload,
    match_job_key,
    match_latest_job_key,
    utcnow_iso,
)
from employer.candidate_matching.models import CandidateRerankOutput
from employer.candidate_matching.repository import CandidateMatchingRepository
from employer.candidate_matching.utils import build_content_signature, normalize_work_formats
from worker.messages.celery_app import celery_app

LOGGER = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)
_T = TypeVar("_T")
billing_service = CreditBillingService()

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
MATCH_CACHE_TTL_SECONDS = 3600
MAX_AI_CANDIDATES = 20

POSTGRES_USER = os.getenv('POSTGRES_USER')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD')
POSTGRES_HOST = os.getenv('POSTGRES_HOST')
POSTGRES_PORT = os.getenv('POSTGRES_PORT')
POSTGRES_DB = os.getenv('POSTGRES_DB')

CELERY_DATABASE_URL = (
    f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
    f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)
CELERY_ENGINE = create_async_engine(
    CELERY_DATABASE_URL,
    echo=False,
    poolclass=NullPool,
)
CELERY_SESSION_FACTORY = async_sessionmaker(
    bind=CELERY_ENGINE,
    expire_on_commit=False,
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
    return CELERY_SESSION_FACTORY()


@asynccontextmanager
async def _celery_session_scope() -> AsyncIterator[AsyncSession]:
    session = await _get_celery_session()
    try:
        yield session
    finally:
        await session.close()


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

    vacancy_formats = normalize_work_formats(
        list(vacancy.get("work_format") or []) + list(vacancy.get("employment_type") or [])
    )
    candidate_formats = normalize_work_formats(candidate.get("employment_type"))
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
    idempotency_suffix: str = "default",
) -> None:
    if amount <= 0:
        return

    async with _celery_session_scope() as session:
        async with session.begin():
            await billing_service.refund_feature_charge(
                session=session,
                user_id=employer_user_id,
                amount=amount,
                idempotency_key=f"refund:{job_id}:{idempotency_suffix}",
                feature_code="candidate_matching",
                reference_type="matching_job",
                reference_id=job_id,
                meta={
                    "reason": reason,
                    "vacancy_id": vacancy_id,
                },
            )


async def _charge_candidate_matching_credits(
    *,
    employer_user_id: int,
    vacancy_id: int,
    job_id: str,
    analyzed_candidates: int,
) -> int:
    amount = get_candidate_matching_credits(analyzed_candidates)
    if amount <= 0:
        return 0

    async with _celery_session_scope() as session:
        async with session.begin():
            await billing_service.charge_for_feature(
                session=session,
                user_id=employer_user_id,
                feature_code="candidate_matching",
                amount=amount,
                idempotency_key=f"candidate_matching:{job_id}",
                reference_type="matching_job",
                reference_id=job_id,
                meta={
                    "vacancy_id": vacancy_id,
                    "analyzed_candidates": analyzed_candidates,
                },
            )

    return amount


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


def _fallback_ai_payload(sql_score: int) -> dict[str, Any]:
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


def _build_ai_payload(ai_result: CandidateRerankOutput, sql_score: int) -> dict[str, Any]:
    score_total = max(0, min(100, int(round((ai_result.score_total * 0.7) + (sql_score * 0.3)))))
    return {
        "score_total": score_total,
        "confidence": 0.7,
        "verdict": ai_result.verdict,
        "summary": ai_result.summary,
    }


def _build_vacancy_signature(vacancy: dict[str, Any]) -> str:
    payload = {
        "title": vacancy.get("title"),
        "description": vacancy.get("description"),
        "responsibilities": vacancy.get("responsibilities"),
        "requirements": vacancy.get("requirements"),
        "employment_type": vacancy.get("employment_type"),
        "work_format": vacancy.get("work_format"),
        "location": vacancy.get("location"),
        "experience_years_min": vacancy.get("experience_years_min"),
        "experience_years_max": vacancy.get("experience_years_max"),
        "salary_min": vacancy.get("salary_min"),
        "salary_max": vacancy.get("salary_max"),
        "salary_currency": vacancy.get("salary_currency"),
    }
    return build_content_signature(payload)


def _build_application_signature(candidate: dict[str, Any]) -> str:
    payload = {
        "resume_id": candidate.get("resume_id"),
        "candidate_user_id": candidate.get("candidate_user_id"),
        "candidate_name": candidate.get("candidate_name"),
        "resume_title": candidate.get("resume_title"),
        "desired_role": candidate.get("desired_role"),
        "resume_summary": candidate.get("resume_summary"),
        "employment_type": candidate.get("employment_type"),
        "location": candidate.get("location"),
        "years_experience": candidate.get("years_experience"),
        "salary_min": candidate.get("salary_min"),
        "salary_max": candidate.get("salary_max"),
        "salary_currency": candidate.get("salary_currency"),
        "cover_letter": candidate.get("cover_letter"),
        "resume_updated_at": candidate.get("resume_updated_at"),
    }
    return build_content_signature(payload)


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
        raise


async def _run_candidate_matching(
    *,
    job_id: str,
    vacancy_id: int,
    employer_user_id: int,
    requested_limit: int,
) -> dict[str, Any]:
    payload = build_job_payload(
        job_id=job_id,
        vacancy_id=vacancy_id,
        created_by_user_id=employer_user_id,
        status="running",
        requested_limit=requested_limit,
    )
    await _store_payload(payload)

    charged_credits = 0
    try:
        repository = CandidateMatchingRepository()
        async with _celery_session_scope() as session:
            async with session.begin():
                vacancy = await repository.get_owned_vacancy(
                    session=session,
                    vacancy_id=vacancy_id,
                    employer_user_id=employer_user_id,
                )
                if vacancy is None:
                    await _set_status(payload=payload, status="failed", error="Vacancy not found")
                    return payload

                candidates = await repository.list_vacancy_candidates(
                    session=session,
                    vacancy=vacancy,
                )

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

        sql_scores_by_application_id = {
            int(row["application_id"]): _heuristic_score(vacancy, row)
            for row in candidates
        }

        SQL_SCORE_THRESHOLD = 30
        filtered_candidates = [
            row for row in candidates
            if sql_scores_by_application_id[int(row["application_id"])] >= SQL_SCORE_THRESHOLD
        ]

        LOGGER.info(
            "SQL filtering: %d candidates passed threshold %d/%d",
            len(filtered_candidates),
            SQL_SCORE_THRESHOLD,
            len(candidates),
        )

        filtered_candidates = sorted(
            filtered_candidates,
            key=lambda r: sql_scores_by_application_id[int(r["application_id"])],
            reverse=True
        )[:MAX_AI_CANDIDATES]

        LOGGER.info(
            "AI limit: %d candidates selected for AI processing (max %d)",
            len(filtered_candidates),
            MAX_AI_CANDIDATES,
        )

        vacancy_signature = _build_vacancy_signature(vacancy)
        application_signature_by_application_id = {
            int(candidate["application_id"]): _build_application_signature(candidate)
            for candidate in filtered_candidates
        }

        cached_ai_results_by_application_id: dict[int, CandidateRerankOutput] = {}
        filtered_application_ids = [int(candidate["application_id"]) for candidate in filtered_candidates]
        async with _celery_session_scope() as session:
            cached_rows = await repository.get_cached_ai_results(
                session=session,
                vacancy_id=vacancy_id,
                vacancy_signature=vacancy_signature,
                application_ids=filtered_application_ids,
            )

        for row in cached_rows:
            application_id = int(row["application_id"])
            expected_signature = application_signature_by_application_id.get(application_id)
            if expected_signature is None:
                continue
            if row.get("application_signature") != expected_signature:
                continue
            if application_id in cached_ai_results_by_application_id:
                continue
            cached_ai_results_by_application_id[application_id] = CandidateRerankOutput(
                score_total=int(row["score_total"]),
                verdict=str(row["verdict"]),
                summary=str(row["summary"]),
            )

        to_rerank_candidates = [
            candidate for candidate in filtered_candidates
            if int(candidate["application_id"]) not in cached_ai_results_by_application_id
        ]

        LOGGER.info(
            "Candidate matching cache reuse for vacancy_id=%s: cached=%s, to_rerank=%s, filtered=%s",
            vacancy_id,
            len(cached_ai_results_by_application_id),
            len(to_rerank_candidates),
            len(filtered_candidates),
        )

        ai_results_by_application_id: dict[int, CandidateRerankOutput] = dict(cached_ai_results_by_application_id)
        fresh_ai_results_by_application_id: dict[int, CandidateRerankOutput] = {}

        if to_rerank_candidates:
            try:
                charged_credits = await _charge_candidate_matching_credits(
                    employer_user_id=employer_user_id,
                    vacancy_id=vacancy_id,
                    job_id=job_id,
                    analyzed_candidates=len(to_rerank_candidates),
                )
            except HTTPException as exc:
                if exc.status_code == 402:
                    LOGGER.warning(
                        "Insufficient credits for candidate matching vacancy_id=%s, job_id=%s. "
                        "Falling back to SQL scores for uncached candidates.",
                        vacancy_id,
                        job_id,
                    )
                else:
                    raise
            else:
                try:
                    fresh_ai_results_by_application_id = await rerank_candidates(vacancy, to_rerank_candidates)
                except Exception:
                    LOGGER.warning(
                        "Batch AI rerank failed for vacancy_id=%s, job_id=%s. Falling back to SQL scores.",
                        vacancy_id,
                        job_id,
                        exc_info=True,
                    )
                    fresh_ai_results_by_application_id = {}

                if fresh_ai_results_by_application_id:
                    model_name = os.getenv("CANDIDATE_MATCH_MODEL", "openrouter/free")
                    upsert_rows = [
                        {
                            "application_id": application_id,
                            "application_signature": application_signature_by_application_id[application_id],
                            "score_total": ai_result.score_total,
                            "verdict": ai_result.verdict,
                            "summary": ai_result.summary,
                        }
                        for application_id, ai_result in fresh_ai_results_by_application_id.items()
                        if application_id in application_signature_by_application_id
                    ]
                    if upsert_rows:
                        async with _celery_session_scope() as session:
                            async with session.begin():
                                await repository.upsert_cached_ai_results(
                                    session=session,
                                    vacancy_id=vacancy_id,
                                    vacancy_signature=vacancy_signature,
                                    model_name=model_name,
                                    cache_rows=upsert_rows,
                                )

                ai_results_by_application_id.update(fresh_ai_results_by_application_id)

                actual_credits = get_candidate_matching_credits(len(fresh_ai_results_by_application_id))
                refund_amount = max(charged_credits - actual_credits, 0)
                if refund_amount > 0:
                    await _refund_candidate_matching_credits(
                        employer_user_id=employer_user_id,
                        vacancy_id=vacancy_id,
                        job_id=job_id,
                        amount=refund_amount,
                        reason="partial_ai_results",
                        idempotency_suffix="partial",
                    )
                    charged_credits -= refund_amount

        if 0 < len(fresh_ai_results_by_application_id) < len(to_rerank_candidates):
            LOGGER.warning(
                "Batch AI rerank returned partial fresh results for vacancy_id=%s, job_id=%s: %s/%s (filtered from %s total)",
                vacancy_id,
                job_id,
                len(fresh_ai_results_by_application_id),
                len(to_rerank_candidates),
                len(candidates),
            )

        scored_rows: list[dict[str, Any]] = []
        for row in candidates:
            application_id = int(row["application_id"])
            sql_score = sql_scores_by_application_id[application_id]
            ai_result = ai_results_by_application_id.get(application_id)
            ai_payload = _build_ai_payload(ai_result, sql_score) if ai_result else _fallback_ai_payload(sql_score)

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
            scored_rows.append(merged)

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
    except Exception:
        if charged_credits > 0:
            try:
                await _refund_candidate_matching_credits(
                    employer_user_id=employer_user_id,
                    vacancy_id=vacancy_id,
                    job_id=job_id,
                    amount=charged_credits,
                    reason="task_failed",
                    idempotency_suffix="failed",
                )
            except Exception:
                LOGGER.exception("Failed to refund credits for candidate matching job_id=%s", job_id)
        raise
