from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import insert, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import (
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


def get_vacancy_search_filters(
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
    exclude_expired: bool = Query(False),
) -> VacancySearchFilters:
    return VacancySearchFilters(
        location=location,
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
