import json
from datetime import datetime, timezone
from typing import Any

from employer.candidate_matching.models import MatchJobStatus


def match_job_key(job_id: str) -> str:
    return f"candidate_match:job:{job_id}"


def match_latest_job_key(vacancy_id: int, employer_user_id: int) -> str:
    return f"candidate_match:latest:vacancy:{vacancy_id}:user:{employer_user_id}"


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_job_payload(
    *,
    job_id: str,
    vacancy_id: int,
    created_by_user_id: int,
    status: MatchJobStatus,
    requested_limit: int,
    created_at: str | None = None,
    updated_at: str | None = None,
    prefiltered_count: int | None = None,
    scored_count: int | None = None,
    error: str | None = None,
    result: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    now = utcnow_iso()
    return {
        "job_id": job_id,
        "vacancy_id": vacancy_id,
        "created_by_user_id": created_by_user_id,
        "status": status,
        "requested_limit": requested_limit,
        "prefiltered_count": prefiltered_count,
        "scored_count": scored_count,
        "created_at": created_at or now,
        "updated_at": updated_at or now,
        "error": error,
        "result": result or [],
    }


def dumps_payload(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False)


def loads_payload(raw: str | bytes | None) -> dict[str, Any] | None:
    if not raw:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
        return None
    except (TypeError, ValueError, json.JSONDecodeError):
        return None
