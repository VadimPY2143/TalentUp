from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import (
    application_history_table,
    companies_table,
    job_applications_table,
    resumes_table,
    vacancies_table,
)

from .models import ApplicationHistoryOut, ApplicationStatus, JobApplicationOut, VacancyBrief


class ApplicationService:
    @staticmethod
    async def ensure_vacancy_exists(session: AsyncSession, vacancy_id: int) -> dict:
        stmt = select(vacancies_table).where(vacancies_table.c.id == vacancy_id)
        result = await session.execute(stmt)
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Vacancy not found")
        return dict(row)

    @staticmethod
    def ensure_vacancy_open_for_apply(vacancy: dict) -> None:
        if not vacancy.get("is_active", False):
            raise HTTPException(status_code=400, detail="Vacancy is not active")

        expires_at = vacancy.get("expires_at")
        if isinstance(expires_at, datetime):
            now_utc = datetime.now(timezone.utc)
            expires_at_utc = expires_at if expires_at.tzinfo else expires_at.replace(
                tzinfo=timezone.utc
            )
            if expires_at_utc <= now_utc:
                raise HTTPException(status_code=400, detail="Vacancy has expired")

    @staticmethod
    def validate_application_status_transition(
        current_status: ApplicationStatus,
        next_status: ApplicationStatus,
    ) -> None:
        allowed_transitions: dict[ApplicationStatus, set[ApplicationStatus]] = {
            ApplicationStatus.applied: {
                ApplicationStatus.viewed,
                ApplicationStatus.rejected,
                ApplicationStatus.accepted,
            },
            ApplicationStatus.viewed: {ApplicationStatus.rejected, ApplicationStatus.accepted},
            ApplicationStatus.rejected: set(),
            ApplicationStatus.accepted: set(),
        }
        if next_status not in allowed_transitions[current_status]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition: {current_status.value} -> {next_status.value}",
            )

    @staticmethod
    async def get_application_for_user_or_employer(
        session: AsyncSession,
        application_id: int,
        current_user: dict,
    ) -> dict:
        stmt = (
            select(
                job_applications_table,
                vacancies_table.c.title.label("vacancy_title"),
                vacancies_table.c.company_id.label("company_id"),
                resumes_table.c.title.label("resume_title"),
                companies_table.c.user_id.label("company_owner_user_id"),
            )
            .select_from(
                job_applications_table.join(
                    vacancies_table, vacancies_table.c.id == job_applications_table.c.vacancy_id
                )
                .join(companies_table, companies_table.c.id == vacancies_table.c.company_id)
                .join(
                    resumes_table,
                    resumes_table.c.id == job_applications_table.c.resume_id,
                    isouter=True,
                )
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

    @staticmethod
    async def load_application_history(
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

    @staticmethod
    def build_application_out(row: dict, history_rows: list[dict]) -> JobApplicationOut:
        vacancy = None
        if "vacancy_title" in row and row.get("company_id") is not None:
            vacancy = VacancyBrief(
                id=row["vacancy_id"],
                title=row["vacancy_title"],
                company_id=row["company_id"],
            )

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
            resume_id=row.get("resume_id"),
            resume_title=row.get("resume_title"),
            cover_letter=row.get("cover_letter"),
            status=ApplicationStatus(row["status"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            vacancy=vacancy,
            history=history,
        )
