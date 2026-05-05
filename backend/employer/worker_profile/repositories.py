from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import (
    languages_table,
    resumes_table,
    user_languages_table,
    user_links_table,
    user_profiles_table,
    users_table,
)


class WorkerProfileRepository:
    async def get_worker_user(self, session: AsyncSession, user_id: int) -> dict[str, Any] | None:
        stmt = select(users_table.c.id, users_table.c.username, users_table.c.role).where(
            users_table.c.id == user_id,
        )
        row = (await session.execute(stmt)).mappings().first()
        return dict(row) if row else None

    async def get_user_profile(self, session: AsyncSession, user_id: int) -> dict[str, Any] | None:
        stmt = select(user_profiles_table).where(user_profiles_table.c.user_id == user_id)
        row = (await session.execute(stmt)).mappings().first()
        return dict(row) if row else None

    async def get_user_languages(self, session: AsyncSession, user_id: int) -> list[dict[str, Any]]:
        stmt = (
            select(
                user_languages_table.c.id,
                user_languages_table.c.language_id,
                languages_table.c.name.label("language_name"),
                user_languages_table.c.proficiency_level,
            )
            .select_from(user_languages_table)
            .join(languages_table, user_languages_table.c.language_id == languages_table.c.id)
            .where(user_languages_table.c.user_id == user_id)
            .order_by(user_languages_table.c.id.asc())
        )
        result = await session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    async def get_user_links(self, session: AsyncSession, user_id: int) -> list[dict[str, Any]]:
        stmt = (
            select(user_links_table)
            .where(user_links_table.c.user_id == user_id)
            .order_by(user_links_table.c.id.asc())
        )
        result = await session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    async def get_active_resumes(self, session: AsyncSession, user_id: int) -> list[dict[str, Any]]:
        stmt = (
            select(
                resumes_table.c.id,
                resumes_table.c.title,
                resumes_table.c.summary,
                resumes_table.c.desired_role,
                resumes_table.c.employment_type,
                resumes_table.c.location,
                resumes_table.c.salary_min,
                resumes_table.c.salary_max,
                resumes_table.c.salary_currency,
                resumes_table.c.years_experience,
                resumes_table.c.is_active,
                resumes_table.c.pdf_file_path,
                resumes_table.c.pdf_original_name,
                resumes_table.c.pdf_size,
                resumes_table.c.pdf_uploaded_at,
                resumes_table.c.updated_at,
            )
            .where(
                resumes_table.c.user_id == user_id,
                resumes_table.c.is_active.is_(True),
            )
            .order_by(resumes_table.c.updated_at.desc(), resumes_table.c.id.desc())
        )
        result = await session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]
