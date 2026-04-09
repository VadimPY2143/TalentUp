from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import (
    job_applications_table,
    resumes_table,
    users_table,
    vacancies_table,
)


class CandidateMatchingRepository:
    @staticmethod
    async def get_owned_vacancy(
        session: AsyncSession,
        vacancy_id: int,
        employer_user_id: int,
    ) -> dict[str, Any] | None:
        stmt = select(vacancies_table).where(
            vacancies_table.c.id == vacancy_id,
            vacancies_table.c.created_by_user_id == employer_user_id,
        )
        result = await session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    @staticmethod
    async def list_vacancy_candidates(
        session: AsyncSession,
        *,
        vacancy: dict[str, Any],
    ) -> list[dict[str, Any]]:
        stmt: Select = (
            select(
                job_applications_table.c.id.label("application_id"),
                job_applications_table.c.resume_id.label("resume_id"),
                job_applications_table.c.user_id.label("candidate_user_id"),
                job_applications_table.c.cover_letter.label("cover_letter"),
                resumes_table.c.title.label("resume_title"),
                resumes_table.c.desired_role.label("desired_role"),
                resumes_table.c.summary.label("resume_summary"),
                resumes_table.c.years_experience.label("years_experience"),
                resumes_table.c.location.label("location"),
                resumes_table.c.city_id.label("city_id"),
                resumes_table.c.employment_type.label("employment_type"),
                resumes_table.c.salary_min.label("salary_min"),
                resumes_table.c.salary_max.label("salary_max"),
                resumes_table.c.salary_currency.label("salary_currency"),
                resumes_table.c.updated_at.label("resume_updated_at"),
                users_table.c.username.label("candidate_name"),
            )
            .select_from(
                job_applications_table.join(
                    resumes_table,
                    resumes_table.c.id == job_applications_table.c.resume_id,
                ).join(
                    users_table,
                    users_table.c.id == job_applications_table.c.user_id,
                )
            )
            .where(
                job_applications_table.c.vacancy_id == vacancy["id"],
                job_applications_table.c.resume_id.isnot(None),
            )
        )

        stmt = stmt.order_by(
            resumes_table.c.updated_at.desc(),
            job_applications_table.c.created_at.desc(),
            job_applications_table.c.id.desc(),
        )

        result = await session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]
