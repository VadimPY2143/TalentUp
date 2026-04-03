from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import insert, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from cities.service import CityService
from database import (
    chat_table,
    get_session,
    resumes_table,
    vacancies_search_history_table,
    vacancies_table,
)
from users.define_roles import require_roles
from search.vacancy_search.filters import (
    EmploymentKind,
    PublishedWithin,
    VacancySearchFilters,
    WorkFormat,
    apply_vacancy_search_filters,
)

router = APIRouter(tags=["vacancy_search"])


def _is_open_vacancy_for_worker(vacancy: dict[str, Any]) -> bool:
    if vacancy.get("is_active") is not True:
        return False

    expires_at = vacancy.get("expires_at")
    if not isinstance(expires_at, datetime):
        return True

    now_utc = datetime.now(timezone.utc)
    expires_at_utc = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
    return expires_at_utc > now_utc


def _build_vacancy_conditions(tokens: list[str]) -> list[Any]:
    conditions: list[Any] = []
    for token in tokens:
        pattern = f"%{token}%"
        conditions.append(vacancies_table.c.title.ilike(pattern))
        conditions.append(vacancies_table.c.description.ilike(pattern))
        conditions.append(vacancies_table.c.requirements.ilike(pattern))
        conditions.append(vacancies_table.c.responsibilities.ilike(pattern))
        conditions.append(vacancies_table.c.location.ilike(pattern))
    return conditions


async def get_vacancy_search_filters(
    session: AsyncSession = Depends(get_session),
    city_id: int | None = Query(None, ge=1),
    location: str | None = Query(None, max_length=255),
    company_id: int | None = Query(None, ge=1),
    employment_kind: list[EmploymentKind] | None = Query(None),
    work_format: list[WorkFormat] | None = Query(None),
    salary_min: int | None = Query(None, ge=0),
    salary_max: int | None = Query(None, ge=0),
    salary_currency: str | None = Query(None, max_length=10),
    experience_years_min: int | None = Query(None, ge=0, le=80),
    experience_years_max: int | None = Query(None, ge=0, le=80),
    published_within: PublishedWithin | None = Query(None),
    exclude_expired: bool = Query(True),
) -> VacancySearchFilters:
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

    return VacancySearchFilters(
        city_id=resolved_city_id,
        location=resolved_location,
        location_aliases=location_aliases,
        company_id=company_id,
        employment_kind=employment_kind,
        work_format=work_format,
        salary_min=salary_min,
        salary_max=salary_max,
        salary_currency=salary_currency,
        experience_years_min=experience_years_min,
        experience_years_max=experience_years_max,
        published_within=published_within,
        exclude_expired=exclude_expired,
    )


@router.get("/vacancy_search")
async def search_vacancy(
    vacancy_name: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    filters: VacancySearchFilters = Depends(get_vacancy_search_filters),
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> dict[str, Any]:
    term = vacancy_name.strip()
    tokens = [token for token in term.split() if len(token) >= 2]
    if not tokens:
        return {"vacancies": []}

    history_stmt = insert(vacancies_search_history_table).values(
        user_id=current_user["id"],
        search_text=term,
    )
    await session.execute(history_stmt)
    await session.commit()

    conditions = _build_vacancy_conditions(tokens)
    stmt = select(vacancies_table)
    stmt = apply_vacancy_search_filters(stmt, filters)
    stmt = (
        stmt.where(vacancies_table.c.is_active.is_(True))
        .where(or_(*conditions))
        .order_by(vacancies_table.c.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    vacancies = [dict(row) for row in result.mappings().all()]
    return {"vacancies": vacancies}


@router.get("/vacancy_search/vacancy/{vacancy_id}")
async def get_vacancy_by_id_for_chat(
    vacancy_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker", "employer"])),
) -> dict[str, Any]:
    stmt = select(vacancies_table).where(vacancies_table.c.id == vacancy_id)
    result = await session.execute(stmt)
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    vacancy = dict(row)

    if current_user["role"] == "worker":
        if _is_open_vacancy_for_worker(vacancy):
            return vacancy

        access_stmt = (
            select(chat_table.c.id)
            .where(
                chat_table.c.vacancy_id == vacancy_id,
                chat_table.c.worker_user_id == current_user["id"],
            )
            .limit(1)
        )
        has_access = (await session.execute(access_stmt)).scalar_one_or_none()
        if has_access is None:
            raise HTTPException(status_code=404, detail="Vacancy not found")
        return vacancy

    if vacancy["created_by_user_id"] == current_user["id"]:
        return vacancy

    access_stmt = (
        select(chat_table.c.id)
        .where(
            chat_table.c.vacancy_id == vacancy_id,
            chat_table.c.employer_user_id == current_user["id"],
        )
        .limit(1)
    )
    has_access = (await session.execute(access_stmt)).scalar_one_or_none()
    if has_access is None:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    return vacancy


@router.get("/vacancy_search/recommendations")
async def vacancy_recommendations(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    filters: VacancySearchFilters = Depends(get_vacancy_search_filters),
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> dict[str, Any]:
    history_stmt = (
        select(vacancies_search_history_table.c.search_text)
        .where(vacancies_search_history_table.c.user_id == current_user["id"])
        .order_by(vacancies_search_history_table.c.id.desc())
        .limit(1)
    )
    history_result = await session.execute(history_stmt)
    last_search = history_result.scalar_one_or_none()

    if last_search:
        term = last_search
    else:
        resume_stmt = (
            select(
                resumes_table.c.desired_role,
                resumes_table.c.title,
                resumes_table.c.summary,
            )
            .where(resumes_table.c.user_id == current_user["id"])
            .order_by(resumes_table.c.id.desc())
            .limit(1)
        )
        resume_result = await session.execute(resume_stmt)
        resume_row = resume_result.mappings().first()
        term = None
        if resume_row:
            term = (
                resume_row.get("desired_role")
                or resume_row.get("title")
                or resume_row.get("summary")
            )

    tokens = [token for token in str(term).split() if len(token) >= 2]
    if not tokens:
        return {"vacancies": []}

    conditions = _build_vacancy_conditions(tokens)
    stmt = select(vacancies_table)
    stmt = apply_vacancy_search_filters(stmt, filters)
    stmt = (
        stmt.where(vacancies_table.c.is_active.is_(True))
        .where(or_(*conditions))
        .order_by(vacancies_table.c.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    vacancies = [dict(row) for row in result.mappings().all()]
    return {"vacancies": vacancies}
