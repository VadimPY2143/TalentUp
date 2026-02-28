from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_session, resumes_table
from users.auth import get_current_user
from .models import EmploymentType, Resume, ResumeUpdate

router = APIRouter()

def normalize_employment_type(value):
    if value is None:
        return None
    return [item.value if isinstance(item, EmploymentType) else item for item in value]


@router.get("/resumes")
async def list_resumes(
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
):
    stmt = select(resumes_table).where(resumes_table.c.user_id == current_user["id"])
    result = await session.execute(stmt)
    return [dict(row) for row in result.mappings().all()]


@router.post("/resumes")
async def create_resume(
    resume: Resume,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
):
    stmt = insert(resumes_table).values(
        user_id=current_user["id"],
        title=resume.title,
        summary=resume.summary,
        desired_role=resume.desired_role,
        employment_type=normalize_employment_type(resume.employment_type),
        location=resume.location,
        salary_min=resume.salary_min,
        salary_max=resume.salary_max,
        salary_currency=resume.salary_currency,
        years_experience=resume.years_experience,
        is_active=resume.is_active,
    )
    await session.execute(stmt)
    await session.commit()
    return {"status": "ok"}


@router.put("/resumes/{resume_id}")
async def update_resume(
    resume_id: int,
    resume: ResumeUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
):
    stmt = select(resumes_table.c.user_id).where(resumes_table.c.id == resume_id)
    result = await session.execute(stmt)
    owner_id = result.scalar()

    if owner_id is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    if owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    values = resume.model_dump(exclude_unset=True)
    if "employment_type" in values:
        values["employment_type"] = normalize_employment_type(values["employment_type"])
    if not values:
        return {"status": "ok"}

    stmt = update(resumes_table).where(resumes_table.c.id == resume_id).values(**values)
    await session.execute(stmt)
    await session.commit()
    return {"status": "ok"}


@router.delete("/resumes/{resume_id}")
async def delete_resume(
    resume_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
):
    stmt = select(resumes_table.c.user_id).where(resumes_table.c.id == resume_id)
    result = await session.execute(stmt)
    owner_id = result.scalar()

    if owner_id is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    if owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    await session.execute(delete(resumes_table).where(resumes_table.c.id == resume_id))
    await session.commit()
    return {"status": "ok"}
