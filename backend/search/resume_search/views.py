from typing import Any, Iterable

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import Select, and_, func, insert, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from database import resumes_table, resume_search_history_table, vacancies_table
from users.define_roles import require_roles
from database import get_session
from search.resume_search.ai_summary import summarize_resume

router = APIRouter(tags=["resume_search"])


class ResumeSearchFilters(BaseModel):
    # UI (as on screenshot)
    city: str | None = Field(default=None, max_length=200)
    remote_only: bool = False
    experience_years: int | None = Field(default=None, ge=0, le=80)
    skills: list[str] | None = None
    salary_from: int | None = Field(default=None, ge=0)
    salary_to: int | None = Field(default=None, ge=0)
    employment_kind: list[str] | None = None  # Full-time/Part-time/Contract/Internship/Temporary

    @model_validator(mode="after")
    def _validate_ranges(self) -> "ResumeSearchFilters":
        if (
            self.salary_from is not None
            and self.salary_to is not None
            and self.salary_from > self.salary_to
        ):
            raise ValueError("salary_from must be <= salary_to")
        return self


def _overlap(column, values: Iterable[str]):
    # Postgres ARRAY overlap: column && ARRAY[...]
    return column.op("&&")(list(values))


def _split_csv(value: str) -> list[str]:
    return [p.strip() for p in value.split(",") if p.strip()]


def _normalize_list(values: list[str] | None) -> list[str]:
    if not values:
        return []
    out: list[str] = []
    for v in values:
        if not v:
            continue
        parts = _split_csv(v) if "," in v else [v.strip()]
        out.extend([p for p in parts if p])
    # de-dup, preserve order
    seen: set[str] = set()
    uniq: list[str] = []
    for v in out:
        if v not in seen:
            seen.add(v)
            uniq.append(v)
    return uniq


def apply_resume_search_filters(stmt: Select, f: ResumeSearchFilters) -> Select:
    conditions = [resumes_table.c.is_active.is_(True)]

    if f.city:
        cities = _split_csv(f.city)
        if cities:
            conditions.append(or_(*[resumes_table.c.city.ilike(f"%{c}%") for c in cities]))

    if f.remote_only:
        conditions.append(_overlap(resumes_table.c.employment_type, ["Remote"]))

    if f.experience_years is not None:
        conditions.append(resumes_table.c.years_experience.isnot(None))
        conditions.append(resumes_table.c.years_experience >= f.experience_years)

    skills = _normalize_list(f.skills)
    if skills:
        conditions.append(
            or_(
                _overlap(resumes_table.c.hard_skills, skills),
                _overlap(resumes_table.c.soft_skills, skills),
                _overlap(resumes_table.c.tags, skills),
            )
        )

    kinds = _normalize_list(f.employment_kind)
    if kinds:
        conditions.append(_overlap(resumes_table.c.employment_kind, kinds))

    # Range intersection with coalesce to handle partial ranges.
    min_salary = func.coalesce(resumes_table.c.salary_min, resumes_table.c.salary_max)
    max_salary = func.coalesce(resumes_table.c.salary_max, resumes_table.c.salary_min)
    if f.salary_from is not None:
        conditions.append(max_salary.isnot(None))
        conditions.append(max_salary >= f.salary_from)
    if f.salary_to is not None:
        conditions.append(min_salary.isnot(None))
        conditions.append(min_salary <= f.salary_to)

    return stmt.where(and_(*conditions))


@router.get('/resume_search')
async def search_resume(
    resume_name: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    filters: ResumeSearchFilters = Depends(),
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"]))
) -> dict[str, Any]:
    term = resume_name.strip()
    tokens = [token for token in term.split() if len(token) >= 2]
    if not tokens:
        return {"resumes": []}

    stmt = insert(resume_search_history_table).values(
        user_id=current_user["id"],
        search_text=term,
    )
    await session.execute(stmt)
    await session.commit()

    conditions = []
    for token in tokens:
        pattern = f"%{token}%"
        conditions.append(resumes_table.c.title.ilike(pattern))
        conditions.append(resumes_table.c.desired_role.ilike(pattern))
        conditions.append(resumes_table.c.summary.ilike(pattern))
        # Arrays stored on resume (tags/skills) - convert to text for token search.
        conditions.append(func.coalesce(func.array_to_string(resumes_table.c.tags, " "), "").ilike(pattern))
        conditions.append(func.coalesce(func.array_to_string(resumes_table.c.hard_skills, " "), "").ilike(pattern))
        conditions.append(func.coalesce(func.array_to_string(resumes_table.c.soft_skills, " "), "").ilike(pattern))

    stmt = select(resumes_table)
    stmt = apply_resume_search_filters(stmt, filters)
    stmt = (
        stmt.where(or_(*conditions))
        .order_by(resumes_table.c.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    resumes = [dict(row) for row in result.mappings().all()]
    return {"resumes": resumes}


@router.get("/resume_search/recommendations")
async def resumes_recommendations(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    filters: ResumeSearchFilters = Depends(),
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> dict[str, Any]:
    history_stmt = (
        select(resume_search_history_table.c.search_text)
        .where(resume_search_history_table.c.user_id == current_user["id"])
        .order_by(resume_search_history_table.c.id.desc())
        .limit(1)
    )
    history_result = await session.execute(history_stmt)
    last_search = history_result.scalar_one_or_none()

    if last_search:
        term = last_search
    else:
        vacancy_stmt = (
            select(vacancies_table.c.title)
            .where(vacancies_table.c.created_by_user_id == current_user["id"])
            .order_by(vacancies_table.c.id.desc())
            .limit(1)
        )
        vacancy_result = await session.execute(vacancy_stmt)
        term = vacancy_result.scalar_one_or_none()

    tokens = [token for token in str(term).split() if len(token) >= 2]
    if not tokens:
        return {"resumes": []}

    conditions = []
    for token in tokens:
        pattern = f"%{token}%"
        conditions.append(resumes_table.c.title.ilike(pattern))
        conditions.append(resumes_table.c.desired_role.ilike(pattern))
        conditions.append(resumes_table.c.summary.ilike(pattern))
        conditions.append(func.coalesce(func.array_to_string(resumes_table.c.tags, " "), "").ilike(pattern))
        conditions.append(func.coalesce(func.array_to_string(resumes_table.c.hard_skills, " "), "").ilike(pattern))
        conditions.append(func.coalesce(func.array_to_string(resumes_table.c.soft_skills, " "), "").ilike(pattern))

    stmt = select(resumes_table)
    stmt = apply_resume_search_filters(stmt, filters)
    stmt = (
        stmt.where(or_(*conditions))
        .order_by(resumes_table.c.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    resumes = [dict(row) for row in result.mappings().all()]
    return {"resumes": resumes}


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

    resume_summary = await summarize_resume(dict(resume_row))

    return resume_summary
