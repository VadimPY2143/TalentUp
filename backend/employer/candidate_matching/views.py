import os
import uuid
from datetime import datetime, timezone

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException, status
from redis.exceptions import RedisError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from employer.candidate_matching.cache import (
    build_job_payload,
    dumps_payload,
    loads_payload,
    match_job_key,
    match_latest_job_key,
    utcnow_iso,
)
from employer.candidate_matching.models import (
    CandidateMatchJobResponse,
    CandidateMatchRunRequest,
    CandidateMatchRunResponse,
)
from employer.candidate_matching.repository import CandidateMatchingRepository
from users.define_roles import require_roles
from worker.messages.celery_app import celery_app

router = APIRouter(tags=["candidate_matching"])

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
MATCH_CACHE_TTL_SECONDS = 3600
MATCH_STALE_SECONDS = 600
redis_client = redis.from_url(REDIS_URL, decode_responses=True)


async def _ensure_owned_vacancy(
    *,
    session: AsyncSession,
    vacancy_id: int,
    employer_user_id: int,
) -> dict:
    vacancy = await CandidateMatchingRepository.get_owned_vacancy(
        session=session,
        vacancy_id=vacancy_id,
        employer_user_id=employer_user_id,
    )
    if vacancy is None:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    return vacancy


async def _get_job_payload(job_id: str) -> dict:
    try:
        raw = await redis_client.get(match_job_key(job_id))
    except RedisError as exc:
        raise HTTPException(status_code=503, detail="Redis is unavailable") from exc
    payload = loads_payload(raw)
    if payload is None:
        raise HTTPException(status_code=404, detail="Matching job not found")

    status_value = str(payload.get("status") or "")
    updated_at_raw = payload.get("updated_at")
    if status_value in {"pending", "running"} and isinstance(updated_at_raw, str):
        try:
            updated_at = datetime.fromisoformat(updated_at_raw.replace("Z", "+00:00"))
            if updated_at.tzinfo is None:
                updated_at = updated_at.replace(tzinfo=timezone.utc)
            age_seconds = (datetime.now(timezone.utc) - updated_at).total_seconds()
            if age_seconds > MATCH_STALE_SECONDS:
                payload["status"] = "failed"
                payload["updated_at"] = utcnow_iso()
                payload["error"] = "Matching job timed out. Please run candidate matching again."
                try:
                    await redis_client.set(
                        match_job_key(job_id),
                        dumps_payload(payload),
                        ex=MATCH_CACHE_TTL_SECONDS,
                    )
                except RedisError:
                    pass
        except ValueError:
            pass

    return payload


@router.post(
    "/vacancies/{vacancy_id}/candidate-matching",
    response_model=CandidateMatchRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_candidate_matching(
    vacancy_id: int,
    payload: CandidateMatchRunRequest,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> CandidateMatchRunResponse:
    await _ensure_owned_vacancy(
        session=session,
        vacancy_id=vacancy_id,
        employer_user_id=current_user["id"],
    )

    job_id = uuid.uuid4().hex
    job_payload = build_job_payload(
        job_id=job_id,
        vacancy_id=vacancy_id,
        created_by_user_id=current_user["id"],
        status="pending",
        requested_limit=payload.requested_limit,
    )

    try:
        await redis_client.set(
            match_job_key(job_id),
            dumps_payload(job_payload),
            ex=MATCH_CACHE_TTL_SECONDS,
        )
        await redis_client.set(
            match_latest_job_key(vacancy_id, current_user["id"]),
            job_id,
            ex=MATCH_CACHE_TTL_SECONDS,
        )
    except RedisError as exc:
        raise HTTPException(status_code=503, detail="Redis is unavailable") from exc

    try:
        celery_app.send_task(
            "employer.candidate_matching.tasks.run_candidate_matching",
            kwargs={
                "job_id": job_id,
                "vacancy_id": vacancy_id,
                "employer_user_id": current_user["id"],
                "requested_limit": payload.requested_limit,
            },
        )
    except Exception as exc:
        job_payload["status"] = "failed"
        job_payload["error"] = f"Failed to enqueue celery task: {exc}"
        try:
            await redis_client.set(
                match_job_key(job_id),
                dumps_payload(job_payload),
                ex=MATCH_CACHE_TTL_SECONDS,
            )
        except RedisError:
            pass
        raise HTTPException(status_code=500, detail="Failed to enqueue matching task") from exc

    return CandidateMatchRunResponse(
        job_id=job_id,
        vacancy_id=vacancy_id,
        status="pending",
        requested_limit=payload.requested_limit,
    )


@router.get(
    "/vacancies/{vacancy_id}/candidate-matching/{job_id}",
    response_model=CandidateMatchJobResponse,
)
async def get_candidate_matching_job(
    vacancy_id: int,
    job_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> CandidateMatchJobResponse:
    await _ensure_owned_vacancy(
        session=session,
        vacancy_id=vacancy_id,
        employer_user_id=current_user["id"],
    )
    payload = await _get_job_payload(job_id)

    if payload.get("vacancy_id") != vacancy_id or payload.get("created_by_user_id") != current_user["id"]:
        raise HTTPException(status_code=404, detail="Matching job not found")

    return CandidateMatchJobResponse.model_validate(payload)


@router.get(
    "/vacancies/{vacancy_id}/candidate-matching",
    response_model=CandidateMatchJobResponse,
)
async def get_latest_candidate_matching_job(
    vacancy_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> CandidateMatchJobResponse:
    await _ensure_owned_vacancy(
        session=session,
        vacancy_id=vacancy_id,
        employer_user_id=current_user["id"],
    )

    try:
        latest_job_id = await redis_client.get(match_latest_job_key(vacancy_id, current_user["id"]))
    except RedisError as exc:
        raise HTTPException(status_code=503, detail="Redis is unavailable") from exc

    if not latest_job_id:
        raise HTTPException(status_code=404, detail="No matching job found for this vacancy")

    payload = await _get_job_payload(str(latest_job_id))
    if payload.get("vacancy_id") != vacancy_id or payload.get("created_by_user_id") != current_user["id"]:
        raise HTTPException(status_code=404, detail="Matching job not found")

    return CandidateMatchJobResponse.model_validate(payload)
