from __future__ import annotations

import time
from datetime import datetime
from enum import Enum
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import (
    DateTime,
    delete,
    func,
    insert,
    select,
    update,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from employer.vacancy.models import VacancyResponse
from database import (
    application_history_table,
    companies_table,
    get_session,
    job_applications_table,
    resumes_table,
    saved_resumes_table,
    saved_vacancies_table,
    vacancies_table,
)
from users.auth import get_current_user
from users.define_roles import require_roles
from .models import Resume, ResumeUpdate
from logger import logger as LOGGER
from .tools import (
    BACKEND_DIR,
    MAX_PDF_SIZE_BYTES,
    UPLOAD_ROOT,
    get_owned_resume,
    normalize_employment_type,
    remove_pdf_from_disk,
)

router = APIRouter(tags=["resumes", "applications", "saved vacancies"])


class ApplicationStatus(str, Enum):
    applied = "applied"
    viewed = "viewed"
    rejected = "rejected"
    accepted = "accepted"


class VacancyBrief(BaseModel):
    id: int
    title: str
    company_id: int


class ApplicationHistoryOut(BaseModel):
    id: int
    status: ApplicationStatus
    comment: str | None = None
    changed_at: datetime


class JobApplicationOut(BaseModel):
    id: int
    user_id: int
    vacancy_id: int
    cover_letter: str | None = None
    status: ApplicationStatus
    created_at: datetime
    updated_at: datetime
    vacancy: VacancyBrief | None = None
    history: list[ApplicationHistoryOut] = Field(default_factory=list)


class JobApplicationCreateIn(BaseModel):
    vacancy_id: int = Field(ge=1)
    cover_letter: str | None = None


class JobApplicationStatusUpdateIn(BaseModel):
    status: ApplicationStatus
    comment: str | None = None


class SavedVacancyCreateIn(BaseModel):
    vacancy_id: int = Field(ge=1)
    note: str | None = Field(default=None, max_length=1000)


class SavedVacancyUpdateIn(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


class SavedVacancyOut(BaseModel):
    id: int
    user_id: int
    vacancy_id: int
    note: str | None = None
    created_at: datetime
    updated_at: datetime
    is_applied: bool
    application_id: int | None = None
    application_status: ApplicationStatus | None = None
    vacancy: VacancyResponse


async def _ensure_vacancy_exists(session: AsyncSession, vacancy_id: int) -> dict:
    stmt = select(vacancies_table).where(vacancies_table.c.id == vacancy_id)
    result = await session.execute(stmt)
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    return dict(row)


def _saved_vacancy_stmt(user_id: int):
    return (
        select(
            saved_vacancies_table.c.id,
            saved_vacancies_table.c.user_id,
            saved_vacancies_table.c.vacancy_id,
            saved_vacancies_table.c.note,
            saved_vacancies_table.c.created_at,
            saved_vacancies_table.c.updated_at,
            vacancies_table.c.company_id.label("company_id"),
            vacancies_table.c.created_by_user_id.label("created_by_user_id"),
            vacancies_table.c.title.label("vacancy_title"),
            vacancies_table.c.description.label("vacancy_description"),
            vacancies_table.c.responsibilities.label("vacancy_responsibilities"),
            vacancies_table.c.requirements.label("vacancy_requirements"),
            vacancies_table.c.is_active.label("vacancy_is_active"),
            vacancies_table.c.employment_type.label("vacancy_employment_type"),
            vacancies_table.c.location.label("vacancy_location"),
            vacancies_table.c.salary_min.label("vacancy_salary_min"),
            vacancies_table.c.salary_max.label("vacancy_salary_max"),
            vacancies_table.c.salary_currency.label("vacancy_salary_currency"),
            vacancies_table.c.experience_years_min.label("vacancy_experience_years_min"),
            vacancies_table.c.experience_years_max.label("vacancy_experience_years_max"),
            vacancies_table.c.work_format.label("vacancy_work_format"),
            vacancies_table.c.expires_at.label("vacancy_expires_at"),
            vacancies_table.c.created_at.label("vacancy_created_at"),
            vacancies_table.c.updated_at.label("vacancy_updated_at"),
            job_applications_table.c.id.label("application_id"),
            job_applications_table.c.status.label("application_status"),
        )
        .select_from(
            saved_vacancies_table.join(
                vacancies_table,
                vacancies_table.c.id == saved_vacancies_table.c.vacancy_id,
            ).outerjoin(
                job_applications_table,
                (job_applications_table.c.vacancy_id == saved_vacancies_table.c.vacancy_id)
                & (job_applications_table.c.user_id == saved_vacancies_table.c.user_id),
            )
        )
        .where(saved_vacancies_table.c.user_id == user_id)
    )


def _build_saved_vacancy_out(row: dict) -> SavedVacancyOut:
    vacancy = VacancyResponse(
        id=row["vacancy_id"],
        company_id=row["company_id"],
        created_by_user_id=row["created_by_user_id"],
        title=row["vacancy_title"],
        description=row["vacancy_description"],
        responsibilities=row.get("vacancy_responsibilities"),
        requirements=row.get("vacancy_requirements"),
        is_active=row["vacancy_is_active"],
        employment_type=row.get("vacancy_employment_type"),
        location=row.get("vacancy_location"),
        salary_min=row.get("vacancy_salary_min"),
        salary_max=row.get("vacancy_salary_max"),
        salary_currency=row.get("vacancy_salary_currency"),
        experience_years_min=row.get("vacancy_experience_years_min"),
        experience_years_max=row.get("vacancy_experience_years_max"),
        work_format=row.get("vacancy_work_format"),
        expires_at=row.get("vacancy_expires_at"),
        created_at=row["vacancy_created_at"],
        updated_at=row["vacancy_updated_at"],
    )
    application_status = row.get("application_status")
    return SavedVacancyOut(
        id=row["id"],
        user_id=row["user_id"],
        vacancy_id=row["vacancy_id"],
        note=row.get("note"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        is_applied=row.get("application_id") is not None,
        application_id=row.get("application_id"),
        application_status=ApplicationStatus(application_status) if application_status else None,
        vacancy=vacancy,
    )


async def _get_saved_vacancy_for_user(
    session: AsyncSession,
    saved_vacancy_id: int,
    user_id: int,
) -> dict:
    stmt = _saved_vacancy_stmt(user_id=user_id).where(saved_vacancies_table.c.id == saved_vacancy_id)
    result = await session.execute(stmt)
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Saved vacancy not found")
    return dict(row)


async def _get_application_for_user_or_employer(
    session: AsyncSession,
    application_id: int,
    current_user: dict,
) -> dict:
    stmt = (
        select(
            job_applications_table,
            vacancies_table.c.title.label("vacancy_title"),
            vacancies_table.c.company_id.label("company_id"),
            companies_table.c.user_id.label("company_owner_user_id"),
        )
        .select_from(
            job_applications_table.join(
                vacancies_table, vacancies_table.c.id == job_applications_table.c.vacancy_id
            ).join(companies_table, companies_table.c.id == vacancies_table.c.company_id)
        )
        .where(job_applications_table.c.id == application_id)
    )

    if current_user["role"] == "employer":
        stmt = stmt.where(companies_table.c.user_id == current_user["id"])
    else:
        stmt = stmt.where(job_applications_table.c.user_id == current_user["id"])

    result = await session.execute(stmt)
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    return dict(row)


async def _load_application_history(
    session: AsyncSession,
    application_id: int,
) -> list[dict]:
    stmt = (
        select(application_history_table)
        .where(application_history_table.c.application_id == application_id)
        .order_by(application_history_table.c.changed_at.asc(), application_history_table.c.id.asc())
    )
    result = await session.execute(stmt)
    return [dict(r) for r in result.mappings().all()]


def _build_application_out(row: dict, history_rows: list[dict]) -> JobApplicationOut:
    vacancy = None
    if "vacancy_title" in row and row.get("company_id") is not None:
        vacancy = VacancyBrief(id=row["vacancy_id"], title=row["vacancy_title"], company_id=row["company_id"])

    history = [
        ApplicationHistoryOut(
            id=h["id"],
            status=ApplicationStatus(h["status"]),
            comment=h.get("comment"),
            changed_at=h["changed_at"],
        )
        for h in history_rows
    ]

    return JobApplicationOut(
        id=row["id"],
        user_id=row["user_id"],
        vacancy_id=row["vacancy_id"],
        cover_letter=row.get("cover_letter"),
        status=ApplicationStatus(row["status"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        vacancy=vacancy,
        history=history,
    )

@router.get("/resumes")
async def list_resumes(
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
):
    stmt = select(resumes_table).where(resumes_table.c.user_id == current_user["id"])
    result = await session.execute(stmt)
    return [dict(row) for row in result.mappings().all()]


@router.post(
    "/saved-vacancies",
    response_model=SavedVacancyOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_saved_vacancy(
    payload: SavedVacancyCreateIn,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> SavedVacancyOut:
    await _ensure_vacancy_exists(session=session, vacancy_id=payload.vacancy_id)

    async with session.begin():
        duplicate_stmt = select(saved_vacancies_table.c.id).where(
            saved_vacancies_table.c.user_id == current_user["id"],
            saved_vacancies_table.c.vacancy_id == payload.vacancy_id,
        )
        duplicate = (await session.execute(duplicate_stmt)).scalar_one_or_none()
        if duplicate is not None:
            raise HTTPException(status_code=409, detail="Vacancy is already saved")

        try:
            stmt = (
                insert(saved_vacancies_table)
                .values(
                    user_id=current_user["id"],
                    vacancy_id=payload.vacancy_id,
                    note=payload.note,
                )
                .returning(saved_vacancies_table.c.id)
            )
            result = await session.execute(stmt)
            saved_vacancy_id = result.scalar_one()
        except IntegrityError as exc:
            msg = str(getattr(exc, "orig", exc))
            if "uq_saved_vacancies_user_vacancy" in msg or "saved_vacancies" in msg:
                raise HTTPException(status_code=409, detail="Vacancy is already saved") from exc
            raise

    row = await _get_saved_vacancy_for_user(
        session=session,
        saved_vacancy_id=saved_vacancy_id,
        user_id=current_user["id"],
    )
    return _build_saved_vacancy_out(row)


@router.get("/saved-vacancies", response_model=list[SavedVacancyOut])
async def list_saved_vacancies(
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> list[SavedVacancyOut]:
    stmt = _saved_vacancy_stmt(user_id=current_user["id"]).order_by(
        saved_vacancies_table.c.created_at.desc(),
        saved_vacancies_table.c.id.desc(),
    )
    result = await session.execute(stmt)
    return [_build_saved_vacancy_out(dict(row)) for row in result.mappings().all()]


@router.get("/saved-vacancies/{saved_vacancy_id}", response_model=SavedVacancyOut)
async def get_saved_vacancy(
    saved_vacancy_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> SavedVacancyOut:
    row = await _get_saved_vacancy_for_user(
        session=session,
        saved_vacancy_id=saved_vacancy_id,
        user_id=current_user["id"],
    )
    return _build_saved_vacancy_out(row)


@router.patch("/saved-vacancies/{saved_vacancy_id}", response_model=SavedVacancyOut)
async def update_saved_vacancy(
    saved_vacancy_id: int,
    payload: SavedVacancyUpdateIn,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> SavedVacancyOut:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(status_code=400, detail="No fields to update")

    stmt = (
        update(saved_vacancies_table)
        .where(
            saved_vacancies_table.c.id == saved_vacancy_id,
            saved_vacancies_table.c.user_id == current_user["id"],
        )
        .values(**values, updated_at=func.now())
        .returning(saved_vacancies_table.c.id)
    )
    result = await session.execute(stmt)
    updated_id = result.scalar_one_or_none()
    if updated_id is None:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Saved vacancy not found")

    await session.commit()
    row = await _get_saved_vacancy_for_user(
        session=session,
        saved_vacancy_id=updated_id,
        user_id=current_user["id"],
    )
    return _build_saved_vacancy_out(row)


@router.delete("/saved-vacancies/{saved_vacancy_id}")
async def delete_saved_vacancy(
    saved_vacancy_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
):
    stmt = (
        delete(saved_vacancies_table)
        .where(
            saved_vacancies_table.c.id == saved_vacancy_id,
            saved_vacancies_table.c.user_id == current_user["id"],
        )
        .returning(saved_vacancies_table.c.id)
    )
    result = await session.execute(stmt)
    deleted = result.scalar_one_or_none()
    if deleted is None:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Saved vacancy not found")

    await session.commit()
    return {"status": "ok"}


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
        salary_currency=resume.salary_currency.value,
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
    await get_owned_resume(session, resume_id, current_user["id"])

    values = resume.model_dump(exclude_unset=True)
    if "employment_type" in values:
        values["employment_type"] = normalize_employment_type(values["employment_type"])
    if "salary_currency" in values and values["salary_currency"] is not None:
        values["salary_currency"] = values["salary_currency"].value
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
    resume = await get_owned_resume(session, resume_id, current_user["id"])
    remove_pdf_from_disk(resume.get("pdf_file_path"))

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
    resume = await get_owned_resume(session, resume_id, current_user["id"])
    original_name = file.filename or "vacancy_search.pdf"
    extension = Path(original_name).suffix.lower()
    if extension != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    content = await file.read(MAX_PDF_SIZE_BYTES + 1)
    if len(content) > MAX_PDF_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="PDF file is too large")
    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Invalid PDF file")

    user_dir = UPLOAD_ROOT / str(current_user["id"])
    user_dir.mkdir(parents=True, exist_ok=True)
    server_filename = f"resume_{resume_id}_{int(time.time())}.pdf"
    file_path = user_dir / server_filename
    file_path.write_bytes(content)

    old_pdf = resume.get("pdf_file_path")
    remove_pdf_from_disk(old_pdf)

    relative_path = str(file_path.relative_to(BACKEND_DIR))
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
        resume = await get_owned_resume(session, resume_id, current_user["id"])
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

    file_path = (BACKEND_DIR / pdf_file_path).resolve()
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
    resume = await get_owned_resume(session, resume_id, current_user["id"])
    remove_pdf_from_disk(resume.get("pdf_file_path"))

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


@router.post(
    "/applications",
    response_model=JobApplicationOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_application(
    payload: JobApplicationCreateIn,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> JobApplicationOut:
    if current_user["role"] != "worker":
        raise HTTPException(status_code=403, detail="Only workers can apply to vacancies")

    async with session.begin():
        vacancy = await _ensure_vacancy_exists(session=session, vacancy_id=payload.vacancy_id)

        duplicate_stmt = select(job_applications_table.c.id).where(
            job_applications_table.c.user_id == current_user["id"],
            job_applications_table.c.vacancy_id == payload.vacancy_id,
        )
        duplicate = (await session.execute(duplicate_stmt)).scalar_one_or_none()
        if duplicate is not None:
            raise HTTPException(status_code=409, detail="You have already applied to this vacancy")

        try:
            stmt = (
                insert(job_applications_table)
                .values(
                    user_id=current_user["id"],
                    vacancy_id=payload.vacancy_id,
                    cover_letter=payload.cover_letter,
                    status=ApplicationStatus.applied.value,
                )
                .returning(*job_applications_table.c)
            )
            result = await session.execute(stmt)
            app_row = dict(result.mappings().one())

            await session.execute(
                insert(application_history_table).values(
                    application_id=app_row["id"],
                    status=ApplicationStatus.applied.value,
                    comment=None,
                )
            )
        except IntegrityError as exc:
            msg = str(getattr(exc, "orig", exc))
            if "uq_job_applications_user_vacancy" in msg or "job_applications" in msg:
                raise HTTPException(
                    status_code=409,
                    detail="You have already applied to this vacancy",
                ) from exc
            raise

    history_rows = await _load_application_history(session=session, application_id=app_row["id"])
    app_row["vacancy_title"] = vacancy["title"]
    app_row["company_id"] = vacancy["company_id"]
    return _build_application_out(app_row, history_rows)


@router.get("/applications/my", response_model=list[JobApplicationOut])
async def list_my_applications(
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> list[JobApplicationOut]:
    if current_user["role"] != "worker":
        raise HTTPException(status_code=403, detail="Only workers can view this endpoint")

    stmt = (
        select(
            job_applications_table,
            vacancies_table.c.title.label("vacancy_title"),
            vacancies_table.c.company_id.label("company_id"),
        )
        .select_from(
            job_applications_table.join(
                vacancies_table, vacancies_table.c.id == job_applications_table.c.vacancy_id
            )
        )
        .where(job_applications_table.c.user_id == current_user["id"])
        .order_by(job_applications_table.c.created_at.desc(), job_applications_table.c.id.desc())
    )
    result = await session.execute(stmt)
    app_rows = [dict(r) for r in result.mappings().all()]
    if not app_rows:
        return []

    app_ids = [r["id"] for r in app_rows]
    history_stmt = (
        select(application_history_table)
        .where(application_history_table.c.application_id.in_(app_ids))
        .order_by(application_history_table.c.changed_at.asc(), application_history_table.c.id.asc())
    )
    history_result = await session.execute(history_stmt)
    history_rows = [dict(r) for r in history_result.mappings().all()]

    grouped: dict[int, list[dict]] = {app_id: [] for app_id in app_ids}
    for h in history_rows:
        grouped.setdefault(h["application_id"], []).append(h)

    return [_build_application_out(r, grouped.get(r["id"], [])) for r in app_rows]


@router.get("/applications/{application_id}", response_model=JobApplicationOut)
async def get_application_by_id(
    application_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> JobApplicationOut:
    app_row = await _get_application_for_user_or_employer(
        session=session,
        application_id=application_id,
        current_user=current_user,
    )
    history_rows = await _load_application_history(session=session, application_id=application_id)
    return _build_application_out(app_row, history_rows)


@router.get("/applications/{application_id}/history", response_model=list[ApplicationHistoryOut])
async def get_application_history(
    application_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> list[ApplicationHistoryOut]:
    await _get_application_for_user_or_employer(
        session=session,
        application_id=application_id,
        current_user=current_user,
    )
    history_rows = await _load_application_history(session=session, application_id=application_id)
    return [
        ApplicationHistoryOut(
            id=h["id"],
            status=ApplicationStatus(h["status"]),
            comment=h.get("comment"),
            changed_at=h["changed_at"],
        )
        for h in history_rows
    ]


@router.patch("/applications/{application_id}/status", response_model=JobApplicationOut)
async def update_application_status(
    application_id: int,
    payload: JobApplicationStatusUpdateIn,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> JobApplicationOut:
    async with session.begin():
        app_row = await _get_application_for_user_or_employer(
            session=session,
            application_id=application_id,
            current_user=current_user,
        )

        if app_row["status"] == payload.status.value:
            raise HTTPException(status_code=400, detail="Status is already set to this value")

        stmt = (
            update(job_applications_table)
            .where(job_applications_table.c.id == application_id)
            .values(status=payload.status.value, updated_at=func.now())
            .returning(*job_applications_table.c)
        )
        result = await session.execute(stmt)
        updated = dict(result.mappings().one())

        await session.execute(
            insert(application_history_table).values(
                application_id=application_id,
                status=payload.status.value,
                comment=payload.comment,
            )
        )

    merged = {
        **updated,
        "vacancy_title": app_row.get("vacancy_title"),
        "company_id": app_row.get("company_id"),
    }
    history_rows = await _load_application_history(session=session, application_id=application_id)
    return _build_application_out(merged, history_rows)

