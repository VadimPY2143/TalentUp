from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, insert, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from cities.service import CityService
from database import get_session, resume_search_history_table, resumes_table, vacancies_table
from search.resume_search.ai_summary import (
    build_resume_summary_cache_key,
    get_cached_resume_summary,
    set_cached_resume_summary,
    summarize_resume,
)
from search.resume_search.filters import ResumeSearchFilters, apply_resume_search_filters
from search.resume_search.models import ResumeSummaryResponse
from payments.billing import CreditBillingService, RESUME_SUMMARY_CREDITS
from users.define_roles import require_roles

router = APIRouter(tags=["resume_search"])
billing_service = CreditBillingService()


def _build_token_conditions(term: str) -> list[Any]:
    tokens = [token for token in term.split() if len(token) >= 2]
    conditions: list[Any] = []
    for token in tokens:
        pattern = f"%{token}%"
        conditions.append(resumes_table.c.title.ilike(pattern))
        conditions.append(resumes_table.c.desired_role.ilike(pattern))
        conditions.append(resumes_table.c.summary.ilike(pattern))
        conditions.append(resumes_table.c.location.ilike(pattern))
        conditions.append(
            func.coalesce(func.array_to_string(resumes_table.c.employment_type, " "), "").ilike(pattern)
        )
    return conditions


async def _load_resumes_with_total(
    *,
    session: AsyncSession,
    filters: ResumeSearchFilters,
    conditions: list[Any],
    limit: int,
    offset: int,
) -> tuple[list[dict[str, Any]], int]:
    base_stmt = select(resumes_table)
    base_stmt = apply_resume_search_filters(base_stmt, filters)
    base_stmt = base_stmt.where(or_(*conditions))

    count_stmt = select(func.count()).select_from(base_stmt.order_by(None).subquery())
    total = int((await session.execute(count_stmt)).scalar_one() or 0)

    rows_stmt = (
        base_stmt.order_by(resumes_table.c.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows_result = await session.execute(rows_stmt)
    resumes = [dict(row) for row in rows_result.mappings().all()]
    return resumes, total


async def get_resume_search_filters(
    session: AsyncSession = Depends(get_session),
    city_id: int | None = Query(None, ge=1),
    location: str | None = Query(None, max_length=255),
    employment_type: list[str] | None = Query(None),
    salary_from: int | None = Query(None, ge=0),
    salary_to: int | None = Query(None, ge=0),
    salary_currency: str | None = Query(None, max_length=10),
    years_experience: int | None = Query(None, ge=0, le=80),
) -> ResumeSearchFilters:
    resolved_city_id = city_id
    resolved_location = location
    location_aliases: list[str] | None = None
    city_service = CityService(session=session)

    if city_id is not None:
        city = await city_service.get_city_by_id(city_id)
        if city is None:
            raise HTTPException(status_code=400, detail="City not found")
        location_aliases = await city_service.get_city_aliases(city_id)
        resolved_location = city["name_uk"]
    elif location:
        city = await city_service.find_city_by_alias(location)
        if city is not None:
            resolved_city_id = city["id"]
            resolved_location = city["name_uk"]
            location_aliases = await city_service.get_city_aliases(city["id"])

    return ResumeSearchFilters(
        city_id=resolved_city_id,
        location=resolved_location,
        location_aliases=location_aliases,
        employment_type=employment_type,
        salary_from=salary_from,
        salary_to=salary_to,
        salary_currency=salary_currency,
        years_experience=years_experience,
    )


@router.get("/resume_search")
async def search_resume(
    resume_name: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    filters: ResumeSearchFilters = Depends(get_resume_search_filters),
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> dict[str, Any]:
    term = resume_name.strip()
    conditions = _build_token_conditions(term)
    if not conditions:
        return {"resumes": [], "total": 0}

    await session.execute(
        insert(resume_search_history_table).values(
            user_id=current_user["id"],
            search_text=term,
        )
    )
    await session.commit()

    resumes, total = await _load_resumes_with_total(
        session=session,
        filters=filters,
        conditions=conditions,
        limit=limit,
        offset=offset,
    )
    return {"resumes": resumes, "total": total}


@router.get("/resume_search/recommendations")
async def resumes_recommendations(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    filters: ResumeSearchFilters = Depends(get_resume_search_filters),
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> dict[str, Any]:
    history_stmt = (
        select(resume_search_history_table.c.search_text)
        .where(resume_search_history_table.c.user_id == current_user["id"])
        .order_by(resume_search_history_table.c.id.desc())
        .limit(1)
    )
    last_search = (await session.execute(history_stmt)).scalar_one_or_none()

    if last_search:
        term = last_search
    else:
        vacancy_stmt = (
            select(vacancies_table.c.title)
            .where(vacancies_table.c.created_by_user_id == current_user["id"])
            .order_by(vacancies_table.c.id.desc())
            .limit(1)
        )
        term = (await session.execute(vacancy_stmt)).scalar_one_or_none()

    conditions = _build_token_conditions(str(term or ""))
    if not conditions:
        return {"resumes": [], "total": 0}

    resumes, total = await _load_resumes_with_total(
        session=session,
        filters=filters,
        conditions=conditions,
        limit=limit,
        offset=offset,
    )
    return {"resumes": resumes, "total": total}


@router.get("/resume_search/summary", response_model=ResumeSummaryResponse)
async def resume_summary(
    resume_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
):
    stmt = select(resumes_table).where(resumes_table.c.id == resume_id)
    result = await session.execute(stmt)
    resume_row = result.mappings().first()
    if not resume_row:
        raise HTTPException(status_code=404, detail="Resume not found")

    user_id = int(current_user["id"])
    cache_key = build_resume_summary_cache_key(
        resume_id=resume_id,
        resume_updated_at=resume_row.get("updated_at"),
    )
    resume_updated_at = resume_row.get("updated_at")
    version = resume_updated_at.isoformat() if resume_updated_at else "none"
    idempotency_key = f"resume_summary:{user_id}:{resume_id}:{version}"

    cached_summary = await get_cached_resume_summary(cache_key)
    if cached_summary is not None:
        return ResumeSummaryResponse(**cached_summary, cached=True)

    already_paid = (
        await billing_service._get_existing_balance_after(
            session=session,
            idempotency_key=idempotency_key,
        )
        is not None
    )
    if already_paid:
        summary = await summarize_resume(dict(resume_row))
        await set_cached_resume_summary(cache_key, summary)
        return ResumeSummaryResponse(**summary, cached=False)

    await billing_service.ensure_sufficient_credits(
        session=session,
        user_id=user_id,
        required_credits=RESUME_SUMMARY_CREDITS,
    )
    summary = await summarize_resume(dict(resume_row))
    await billing_service.charge_for_feature(
        session=session,
        user_id=user_id,
        feature_code="resume_summary",
        amount=RESUME_SUMMARY_CREDITS,
        idempotency_key=idempotency_key,
        reference_type="resume",
        reference_id=str(resume_id),
    )
    await session.commit()
    await set_cached_resume_summary(cache_key, summary)
    return ResumeSummaryResponse(**summary, cached=False)
