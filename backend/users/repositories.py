from datetime import datetime
from typing import Any

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import user_profiles_table, user_languages_table, languages_table, user_links_table


class UserProfileRepository:
    async def get_by_user_id(self, session: AsyncSession, user_id: int) -> dict[str, Any] | None:
        stmt = select(user_profiles_table).where(user_profiles_table.c.user_id == user_id)
        result = await session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def create(
        self,
        session: AsyncSession,
        user_id: int,
        values: dict[str, Any],
    ) -> dict[str, Any]:
        stmt = (
            insert(user_profiles_table)
            .values(user_id=user_id, **values)
            .returning(*user_profiles_table.c)
        )
        result = await session.execute(stmt)
        return dict(result.mappings().one())

    async def update_by_user_id(
        self,
        session: AsyncSession,
        user_id: int,
        values: dict[str, Any],
    ) -> dict[str, Any] | None:
        stmt = (
            update(user_profiles_table)
            .where(user_profiles_table.c.user_id == user_id)
            .values(**values, updated_at=datetime.utcnow())
            .returning(*user_profiles_table.c)
        )
        result = await session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def delete_by_user_id(self, session: AsyncSession, user_id: int) -> bool:
        stmt = (
            delete(user_profiles_table)
            .where(user_profiles_table.c.user_id == user_id)
            .returning(user_profiles_table.c.id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def get_user_languages(self, session: AsyncSession, user_id: int) -> list[dict[str, Any]]:
        stmt = (
            select(user_languages_table, languages_table.c.name)
            .join(languages_table, user_languages_table.c.language_id == languages_table.c.id)
            .where(user_languages_table.c.user_id == user_id)
            .order_by(user_languages_table.c.created_at)
        )
        result = await session.execute(stmt)
        rows = result.mappings().all()
        return [
            {
                "id": row["id"],
                "language_id": row["language_id"],
                "language_name": row["name"],
                "proficiency_level": row["proficiency_level"],
            }
            for row in rows
        ]

    async def upsert_user_languages(
        self,
        session: AsyncSession,
        user_id: int,
        languages: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        # Delete existing user languages
        await session.execute(
            delete(user_languages_table).where(user_languages_table.c.user_id == user_id)
        )

        # Insert new user languages
        if languages:
            for lang in languages:
                # Get language_id from language name
                lang_stmt = select(languages_table.c.id).where(
                    func.lower(languages_table.c.name) == func.lower(lang["name"])
                )
                lang_result = await session.execute(lang_stmt)
                language_id = lang_result.scalar_one_or_none()

                if language_id:
                    await session.execute(
                        insert(user_languages_table).values(
                            user_id=user_id,
                            language_id=language_id,
                            proficiency_level=lang["proficiency_level"],
                        )
                    )

        await session.commit()
        return await self.get_user_languages(session, user_id)

    async def get_user_links(self, session: AsyncSession, user_id: int) -> list[dict[str, Any]]:
        stmt = (
            select(user_links_table)
            .where(user_links_table.c.user_id == user_id)
            .order_by(user_links_table.c.created_at)
        )
        result = await session.execute(stmt)
        rows = result.mappings().all()
        return [
            {
                "id": row["id"],
                "title": row["title"],
                "url": row["url"],
            }
            for row in rows
        ]

    async def upsert_user_links(
        self,
        session: AsyncSession,
        user_id: int,
        links: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        # Delete existing user links
        await session.execute(
            delete(user_links_table).where(user_links_table.c.user_id == user_id)
        )

        # Insert new user links
        if links:
            for link in links:
                await session.execute(
                    insert(user_links_table).values(
                        user_id=user_id,
                        title=link["title"],
                        url=link["url"],
                    )
                )

        await session.commit()
        return await self.get_user_links(session, user_id)
