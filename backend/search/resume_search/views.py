from typing import Any
from fastapi import Depends, APIRouter, Query
from sqlalchemy import select, insert, or_
from sqlalchemy.ext.asyncio import AsyncSession
from database import resumes_table, resume_search_history_table, vacancies_table
from users.define_roles import require_roles
from database import get_session

router = APIRouter(tags=["resume_search"])

@router.get('/resume_search')
async def search_resume(
    resume_name: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
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

    stmt = (
        select(resumes_table)
        .where(or_(*conditions))
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

    stmt = (
        select(resumes_table)
        .where(or_(*conditions))
        .order_by(resumes_table.c.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    resumes = [dict(row) for row in result.mappings().all()]
    return {"resumes": resumes}
