import time
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from cities.service import CityService
from database import (
    companies_table,
    get_session,
    resumes_table,
    saved_resumes_table,
)
from logger import logger as LOGGER
from users.auth import get_current_user
from users.define_roles import require_roles

from .models import Resume, ResumeUpdate
from .services import ResumeService

router = APIRouter(tags=["resumes"])


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
    city_service = CityService(session=session)
    city = await city_service.resolve_city(city_id=resume.city_id, location=resume.location)
    if resume.city_id is not None and city is None:
        raise HTTPException(status_code=400, detail="City not found")

    stmt = (
        insert(resumes_table)
        .values(
            user_id=current_user["id"],
            title=resume.title,
            summary=resume.summary,
            desired_role=resume.desired_role,
            employment_type=ResumeService.normalize_employment_type(resume.employment_type),
            city_id=city["id"] if city else None,
            location=city["name_uk"] if city else resume.location,
            salary_min=resume.salary_min,
            salary_max=resume.salary_max,
            salary_currency=resume.salary_currency.value,
            years_experience=resume.years_experience,
            is_active=resume.is_active,
        )
        .returning(resumes_table.c.id)
    )
    result = await session.execute(stmt)
    await session.commit()
    return {"status": "ok", "id": result.scalar_one()}


@router.put("/resumes/{resume_id}")
async def update_resume(
    resume_id: int,
    resume: ResumeUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
):
    await ResumeService.get_owned_resume(session, resume_id, current_user["id"])

    values = resume.model_dump(exclude_unset=True)
    if "employment_type" in values:
        values["employment_type"] = ResumeService.normalize_employment_type(values["employment_type"])
    if "salary_currency" in values and values["salary_currency"] is not None:
        values["salary_currency"] = values["salary_currency"].value
    if "city_id" in values or "location" in values:
        city_service = CityService(session=session)
        city = await city_service.resolve_city(
            city_id=values.get("city_id"),
            location=values.get("location"),
        )
        if values.get("city_id") is not None and city is None:
            raise HTTPException(status_code=400, detail="City not found")
        values["city_id"] = city["id"] if city else None
        values["location"] = city["name_uk"] if city else values.get("location")
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
    resume = await ResumeService.get_owned_resume(session, resume_id, current_user["id"])
    ResumeService.remove_pdf_from_disk(resume.get("pdf_file_path"))

    await session.execute(delete(resumes_table).where(resumes_table.c.id == resume_id))
    await session.commit()
    return {"status": "ok"}


@router.post("/resumes/{resume_id}/pdf")
async def upload_resume_pdf(
    resume_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
):
    resume = await ResumeService.get_owned_resume(session, resume_id, current_user["id"])
    original_name = file.filename or "vacancy_search.pdf"
    extension = Path(original_name).suffix.lower()
    if extension != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    content = await file.read(ResumeService.MAX_PDF_SIZE_BYTES + 1)
    if len(content) > ResumeService.MAX_PDF_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="PDF file is too large")
    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Invalid PDF file")

    user_dir = ResumeService.UPLOAD_ROOT / str(current_user["id"])
    user_dir.mkdir(parents=True, exist_ok=True)
    server_filename = f"resume_{resume_id}_{int(time.time())}.pdf"
    file_path = user_dir / server_filename
    file_path.write_bytes(content)

    old_pdf = resume.get("pdf_file_path")
    ResumeService.remove_pdf_from_disk(old_pdf)

    relative_path = str(file_path.relative_to(ResumeService.BACKEND_DIR))
    stmt = (
        update(resumes_table)
        .where(resumes_table.c.id == resume_id)
        .values(
            pdf_file_path=relative_path,
            pdf_original_name=original_name[:255],
            pdf_size=len(content),
            pdf_uploaded_at=func.now(),
        )
    )
    await session.execute(stmt)
    await session.commit()
    LOGGER.info("Resume PDF uploaded: resume_id=%s user_id=%s", resume_id, current_user["id"])
    return {"status": "ok", "filename": original_name, "size": len(content)}


@router.get("/resumes/{resume_id}/pdf")
async def download_resume_pdf(
    resume_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker", "employer"])),
):
    if current_user["role"] == "worker":
        resume = await ResumeService.get_owned_resume(session, resume_id, current_user["id"])
    else:
        stmt = select(resumes_table).where(resumes_table.c.id == resume_id)
        result = await session.execute(stmt)
        resume_row = result.mappings().first()
        if not resume_row:
            raise HTTPException(status_code=404, detail="Resume not found")
        resume = dict(resume_row)
    pdf_file_path = resume.get("pdf_file_path")
    if not pdf_file_path:
        raise HTTPException(status_code=404, detail="PDF not found")

    file_path = (ResumeService.BACKEND_DIR / pdf_file_path).resolve()
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF file missing on server")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=resume.get("pdf_original_name") or "vacancy_search.pdf",
    )


@router.delete("/resumes/{resume_id}/pdf")
async def delete_resume_pdf(
    resume_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
):
    resume = await ResumeService.get_owned_resume(session, resume_id, current_user["id"])
    ResumeService.remove_pdf_from_disk(resume.get("pdf_file_path"))

    stmt = (
        update(resumes_table)
        .where(resumes_table.c.id == resume_id)
        .values(
            pdf_file_path=None,
            pdf_original_name=None,
            pdf_size=None,
            pdf_uploaded_at=None,
        )
    )
    await session.execute(stmt)
    await session.commit()
    return {"status": "ok"}


@router.post('/companies/{company_id}/resumes/{resume_id}')
async def save_resume(
    company_id: int,
    resume_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> dict:
    if current_user["role"] != "employer":
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    company_stmt = select(companies_table.c.id).where(
        companies_table.c.id == company_id,
        companies_table.c.user_id == current_user["id"],
    )
    company_exists = (await session.execute(company_stmt)).scalar_one_or_none()
    if not company_exists:
        raise HTTPException(status_code=404, detail="Company not found")

    resume_stmt = select(resumes_table.c.id).where(resumes_table.c.id == resume_id)
    resume_exists = (await session.execute(resume_stmt)).scalar_one_or_none()
    if not resume_exists:
        raise HTTPException(status_code=404, detail="Resume not found")

    duplicate_stmt = select(saved_resumes_table.c.id).where(
        saved_resumes_table.c.company_id == company_id,
        saved_resumes_table.c.saved_resume_id == resume_id,
    )
    is_saved = (await session.execute(duplicate_stmt)).scalar_one_or_none()
    if is_saved:
        return {"status": "ok"}

    stmt = insert(saved_resumes_table).values(company_id=company_id, saved_resume_id=resume_id)
    await session.execute(stmt)
    await session.commit()

    return {"status": "ok"}


@router.get('/companies/{company_id}/saved-resumes')
async def list_saved_resumes(
    company_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> list[dict]:
    if current_user["role"] != "employer":
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    company_stmt = select(companies_table.c.id).where(
        companies_table.c.id == company_id,
        companies_table.c.user_id == current_user["id"],
    )
    company_exists = (await session.execute(company_stmt)).scalar_one_or_none()
    if not company_exists:
        raise HTTPException(status_code=404, detail="Company not found")

    stmt = (
        select(resumes_table)
        .join(saved_resumes_table, saved_resumes_table.c.saved_resume_id == resumes_table.c.id)
        .where(saved_resumes_table.c.company_id == company_id)
        .order_by(saved_resumes_table.c.id.desc())
    )
    result = await session.execute(stmt)
    return [dict(row) for row in result.mappings().all()]
