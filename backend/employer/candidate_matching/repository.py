from typing import Any

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from database import (
    candidate_match_ai_cache_table,
    job_applications_table,
    resumes_table,
    users_table,
    vacancies_table,
)
from employer.candidate_matching.utils import normalize_work_formats


def _should_prefilter_by_city(vacancy: dict[str, Any]) -> bool:
    vacancy_city_id = vacancy.get("city_id")
    if vacancy_city_id is None:
        return False

    work_formats = normalize_work_formats(vacancy.get("work_format"))
    if "Remote" in work_formats:
        return False

    return "Office" in work_formats


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

        # Filter by employment_type intersection
        vacancy_formats = normalize_work_formats(
            list(vacancy.get("work_format") or []) + list(vacancy.get("employment_type") or [])
        )
        if vacancy_formats:
            # Use array_position instead of ARRAY.contains so it works with base ARRAY type.
            fmt_conditions = [
                func.array_position(resumes_table.c.employment_type, fmt).is_not(None)
                for fmt in vacancy_formats
            ]
            stmt = stmt.where(or_(*fmt_conditions))

        # Filter by years_experience
        vacancy_min_exp = vacancy.get("experience_years_min")
        if vacancy_min_exp is not None:
            stmt = stmt.where(
                or_(
                    resumes_table.c.years_experience.is_(None),
                    resumes_table.c.years_experience >= vacancy_min_exp,
                )
            )

        vacancy_salary_min = vacancy.get("salary_min")
        vacancy_salary_max = vacancy.get("salary_max")
        if vacancy_salary_min is not None or vacancy_salary_max is not None:
            lower = vacancy_salary_min if vacancy_salary_min is not None else vacancy_salary_max
            upper = vacancy_salary_max if vacancy_salary_max is not None else vacancy_salary_min
            if lower is not None and upper is not None:
                stmt = stmt.where(
                    or_(
                        resumes_table.c.salary_min.is_(None),
                        resumes_table.c.salary_max.is_(None),
                        and_(
                            resumes_table.c.salary_min <= upper,
                            resumes_table.c.salary_max >= lower,
                        ),
                    )
                )

        if _should_prefilter_by_city(vacancy):
            stmt = stmt.where(resumes_table.c.city_id == vacancy["city_id"])

        stmt = stmt.order_by(
            resumes_table.c.updated_at.desc(),
            job_applications_table.c.created_at.desc(),
            job_applications_table.c.id.desc(),
        )

        result = await session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    @staticmethod
    async def get_cached_ai_results(
        session: AsyncSession,
        *,
        vacancy_id: int,
        vacancy_signature: str,
        application_ids: list[int],
    ) -> list[dict[str, Any]]:
        if not application_ids:
            return []

        stmt = (
            select(
                candidate_match_ai_cache_table.c.application_id,
                candidate_match_ai_cache_table.c.application_signature,
                candidate_match_ai_cache_table.c.score_total,
                candidate_match_ai_cache_table.c.verdict,
                candidate_match_ai_cache_table.c.summary,
                candidate_match_ai_cache_table.c.model_name,
                candidate_match_ai_cache_table.c.analyzed_at,
            )
            .where(
                candidate_match_ai_cache_table.c.vacancy_id == vacancy_id,
                candidate_match_ai_cache_table.c.vacancy_signature == vacancy_signature,
                candidate_match_ai_cache_table.c.application_id.in_(application_ids),
            )
            .order_by(
                candidate_match_ai_cache_table.c.analyzed_at.desc(),
                candidate_match_ai_cache_table.c.id.desc(),
            )
        )
        result = await session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    @staticmethod
    async def upsert_cached_ai_results(
        session: AsyncSession,
        *,
        vacancy_id: int,
        vacancy_signature: str,
        model_name: str,
        cache_rows: list[dict[str, Any]],
    ) -> None:
        if not cache_rows:
            return

        rows = [
            {
                "vacancy_id": vacancy_id,
                "application_id": row["application_id"],
                "vacancy_signature": vacancy_signature,
                "application_signature": row["application_signature"],
                "score_total": row["score_total"],
                "verdict": row["verdict"],
                "summary": row["summary"],
                "model_name": model_name,
            }
            for row in cache_rows
        ]
        insert_stmt = pg_insert(candidate_match_ai_cache_table).values(rows)
        upsert_stmt = insert_stmt.on_conflict_do_update(
            constraint="uq_candidate_match_ai_cache_signature",
            set_={
                "score_total": insert_stmt.excluded.score_total,
                "verdict": insert_stmt.excluded.verdict,
                "summary": insert_stmt.excluded.summary,
                "model_name": insert_stmt.excluded.model_name,
                "analyzed_at": func.now(),
                "updated_at": func.now(),
            },
        )
        await session.execute(upsert_stmt)
