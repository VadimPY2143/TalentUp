from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import (
    application_history_table,
    companies_table,
    get_session,
    job_applications_table,
    resumes_table,
    users_table,
    vacancies_table,
)
from users.auth import get_current_user
from users.define_roles import require_roles
from worker.resumes.services import ResumeService

from .models import (
    ApplicationHistoryOut,
    ApplicationResumeOut,
    ApplicationStatus,
    JobApplicationCreateIn,
    JobApplicationOut,
    JobApplicationStatusUpdateIn,
)
from .services import ApplicationService
from notifications.events import notify_application_status_changed

router = APIRouter(tags=["applications"])


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

    try:
        vacancy = await ApplicationService.ensure_vacancy_exists(
            session=session,
            vacancy_id=payload.vacancy_id,
        )
        ApplicationService.ensure_vacancy_open_for_apply(vacancy)
        selected_resume = await ResumeService.get_owned_resume(
            session=session,
            resume_id=payload.resume_id,
            user_id=current_user["id"],
        )
        if not selected_resume.get("is_active", False):
            raise HTTPException(status_code=400, detail="Selected resume is not active")

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
                    resume_id=payload.resume_id,
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
            original_exc = getattr(exc, "orig", None)
            constraint_name = getattr(original_exc, "constraint_name", None)
            msg = str(original_exc or exc)
            if constraint_name == "uq_job_applications_user_vacancy" or "uq_job_applications_user_vacancy" in msg:
                raise HTTPException(
                    status_code=409,
                    detail="You have already applied to this vacancy",
                ) from exc
            raise
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    history_rows = await ApplicationService.load_application_history(
        session=session,
        application_id=app_row["id"],
    )
    app_row["vacancy_title"] = vacancy["title"]
    app_row["company_id"] = vacancy["company_id"]
    app_row["resume_title"] = selected_resume.get("title")
    app_row["candidate_name"] = current_user.get("username")
    return ApplicationService.build_application_out(app_row, history_rows)


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
            resumes_table.c.title.label("resume_title"),
            users_table.c.username.label("candidate_name"),
        )
        .select_from(
            job_applications_table.join(
                vacancies_table, vacancies_table.c.id == job_applications_table.c.vacancy_id
            ).join(
                users_table, users_table.c.id == job_applications_table.c.user_id
            ).join(
                resumes_table,
                resumes_table.c.id == job_applications_table.c.resume_id,
                isouter=True,
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

    return [ApplicationService.build_application_out(r, grouped.get(r["id"], [])) for r in app_rows]


@router.get("/applications/employer", response_model=list[JobApplicationOut])
async def list_employer_applications(
    vacancy_id: int | None = Query(default=None, ge=1),
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> list[JobApplicationOut]:
    stmt = (
        select(
            job_applications_table,
            vacancies_table.c.title.label("vacancy_title"),
            vacancies_table.c.company_id.label("company_id"),
            resumes_table.c.title.label("resume_title"),
            users_table.c.username.label("candidate_name"),
        )
        .select_from(
            job_applications_table.join(
                vacancies_table, vacancies_table.c.id == job_applications_table.c.vacancy_id
            ).join(companies_table, companies_table.c.id == vacancies_table.c.company_id).join(
                users_table, users_table.c.id == job_applications_table.c.user_id
            ).join(
                resumes_table,
                resumes_table.c.id == job_applications_table.c.resume_id,
                isouter=True,
            )
        )
        .where(companies_table.c.user_id == current_user["id"])
        .order_by(job_applications_table.c.created_at.desc(), job_applications_table.c.id.desc())
    )
    if vacancy_id is not None:
        stmt = stmt.where(job_applications_table.c.vacancy_id == vacancy_id)

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

    return [ApplicationService.build_application_out(r, grouped.get(r["id"], [])) for r in app_rows]


@router.get("/applications/{application_id}", response_model=JobApplicationOut)
async def get_application_by_id(
    application_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> JobApplicationOut:
    app_row = await ApplicationService.get_application_for_user_or_employer(
        session=session,
        application_id=application_id,
        current_user=current_user,
    )
    history_rows = await ApplicationService.load_application_history(
        session=session,
        application_id=application_id,
    )
    return ApplicationService.build_application_out(app_row, history_rows)


@router.get("/applications/{application_id}/history", response_model=list[ApplicationHistoryOut])
async def get_application_history(
    application_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> list[ApplicationHistoryOut]:
    await ApplicationService.get_application_for_user_or_employer(
        session=session,
        application_id=application_id,
        current_user=current_user,
    )
    history_rows = await ApplicationService.load_application_history(
        session=session,
        application_id=application_id,
    )
    return [
        ApplicationHistoryOut(
            id=h["id"],
            status=ApplicationStatus(str(h["status"])),
            comment=h.get("comment"),
            changed_at=h["changed_at"],
        )
        for h in history_rows
    ]


@router.get("/applications/{application_id}/resume", response_model=ApplicationResumeOut)
async def get_application_resume(
    application_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> ApplicationResumeOut:
    app_row = await ApplicationService.get_application_for_user_or_employer(
        session=session,
        application_id=application_id,
        current_user=current_user,
    )
    resume_id = app_row.get("resume_id")
    if not resume_id:
        raise HTTPException(status_code=404, detail="Resume is not attached to this application")

    stmt = select(resumes_table).where(resumes_table.c.id == resume_id)
    result = await session.execute(stmt)
    resume_row = result.mappings().first()
    if not resume_row:
        raise HTTPException(status_code=404, detail="Resume not found")
    return ApplicationResumeOut(**resume_row)


@router.patch("/applications/{application_id}/status", response_model=JobApplicationOut)
async def update_application_status(
    application_id: int,
    payload: JobApplicationStatusUpdateIn,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> JobApplicationOut:
    try:
        app_row = await ApplicationService.get_application_for_user_or_employer(
            session=session,
            application_id=application_id,
            current_user=current_user,
        )

        current_status = ApplicationStatus(str(app_row["status"]))
        if current_status == payload.status:
            raise HTTPException(status_code=400, detail="Status is already set to this value")

        ApplicationService.validate_application_status_transition(
            current_status=current_status,
            next_status=payload.status,
        )

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
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    try:
        await notify_application_status_changed(
            session=session,
            worker_user_id=int(app_row["user_id"]),
            application_id=int(application_id),
            vacancy_id=int(app_row["vacancy_id"]),
            vacancy_title=app_row.get("vacancy_title"),
            from_status=current_status.value,
            to_status=payload.status.value,
            comment=payload.comment,
        )
    except Exception:
        # Notifications must not break core business flow.
        pass

    merged = {
        **updated,
        "vacancy_title": app_row.get("vacancy_title"),
        "company_id": app_row.get("company_id"),
        "candidate_name": app_row.get("candidate_name"),
    }
    history_rows = await ApplicationService.load_application_history(
        session=session,
        application_id=application_id,
    )
    return ApplicationService.build_application_out(merged, history_rows)
