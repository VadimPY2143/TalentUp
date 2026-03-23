from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, insert, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session, resume_search_history_table, resumes_table, vacancies_table
from search.resume_search.ai_summary import summarize_resume
from search.resume_search.filters import ResumeSearchFilters, apply_resume_search_filters
from users.define_roles import require_roles

router = APIRouter(tags=["resume_search"])


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


def get_resume_search_filters(
    location: str | None = Query(None, max_length=255),
    employment_type: list[str] | None = Query(None),
    salary_from: int | None = Query(None, ge=0),
    salary_to: int | None = Query(None, ge=0),
    salary_currency: str | None = Query(None, max_length=10),
    years_experience: int | None = Query(None, ge=0, le=80),
) -> ResumeSearchFilters:
    return ResumeSearchFilters(
        location=location,
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
        return {"resumes": []}

    await session.execute(
        insert(resume_search_history_table).values(
            user_id=current_user["id"],
            search_text=term,
        )
    )
    await session.commit()

    stmt = select(resumes_table)
    stmt = apply_resume_search_filters(stmt, filters)
    stmt = (
        stmt.where(or_(*conditions))
        .order_by(resumes_table.c.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return {"resumes": [dict(row) for row in result.mappings().all()]}


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
        return {"resumes": []}

    stmt = select(resumes_table)
    stmt = apply_resume_search_filters(stmt, filters)
    stmt = (
        stmt.where(or_(*conditions))
        .order_by(resumes_table.c.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return {"resumes": [dict(row) for row in result.mappings().all()]}


@router.get("/resume_search/summary")
async def resume_summary(
    resume_id: int,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(resumes_table).where(resumes_table.c.id == resume_id)
    result = await session.execute(stmt)
    resume_row = result.mappings().first()
    if not resume_row:
        raise HTTPException(status_code=404, detail="Resume not found")

    return await summarize_resume(dict(resume_row))
