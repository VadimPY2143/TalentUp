from typing import Any

from fastapi import HTTPException
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import (
    job_applications_table,
    saved_vacancies_table,
    vacancies_table,
)
from worker.applications.models import ApplicationStatus

from employer.vacancy.models import VacancyResponse
from .models import SavedVacancyOut


class SavedVacancyService:
    @staticmethod
    async def ensure_vacancy_exists(session: AsyncSession, vacancy_id: int) -> dict[str, Any]:
        stmt = select(vacancies_table).where(vacancies_table.c.id == vacancy_id)
        result = await session.execute(stmt)
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Vacancy not found")
        return dict(row)

    @staticmethod
    def saved_vacancy_stmt(user_id: int) -> Select:
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
                vacancies_table.c.city_id.label("vacancy_city_id"),
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

    @staticmethod
    def build_saved_vacancy_out(row: dict[str, Any]) -> SavedVacancyOut:
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
            city_id=row.get("vacancy_city_id"),
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

        application_status_raw = row.get("application_status")
        application_status: ApplicationStatus | None = None
        if application_status_raw is not None:
            try:
                application_status = ApplicationStatus(str(application_status_raw))
            except ValueError:
                application_status = None

        return SavedVacancyOut(
            id=row["id"],
            user_id=row["user_id"],
            vacancy_id=row["vacancy_id"],
            note=row.get("note"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            is_applied=row.get("application_id") is not None,
            application_id=row.get("application_id"),
            application_status=application_status,
            vacancy=vacancy,
        )

    @classmethod
    async def get_saved_vacancy_for_user(
        cls,
        session: AsyncSession,
        saved_vacancy_id: int,
        user_id: int,
    ) -> dict[str, Any]:
        stmt = cls.saved_vacancy_stmt(user_id=user_id).where(
            saved_vacancies_table.c.id == saved_vacancy_id
        )
        result = await session.execute(stmt)
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Saved vacancy not found")
        return dict(row)
