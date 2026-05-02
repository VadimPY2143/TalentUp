from datetime import datetime
from typing import Any

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import refresh_tokens_table, user_profiles_table, users_table
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

    async def get_user_languages(
        self, session: AsyncSession, user_id: int
    ) -> list[dict[str, Any]]:
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
        )
        result = await session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    async def upsert_user_languages(
        self, session: AsyncSession, user_id: int, languages: list[dict[str, Any]]
    ) -> None:
        # Delete existing languages for user
        await session.execute(
            delete(user_languages_table).where(user_languages_table.c.user_id == user_id)
        )
        # Insert new languages
        if languages:
            values = [
                {
                    "user_id": user_id,
                    "language_id": lang["language_id"],
                    "proficiency_level": lang["proficiency_level"],
                }
                for lang in languages
            ]
            await session.execute(insert(user_languages_table).values(values))

    async def get_user_links(self, session: AsyncSession, user_id: int) -> list[dict[str, Any]]:
        stmt = select(user_links_table).where(user_links_table.c.user_id == user_id)
        result = await session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    async def upsert_user_links(
        self, session: AsyncSession, user_id: int, links: list[dict[str, Any]]
    ) -> None:
        # Delete existing links for user
        await session.execute(
            delete(user_links_table).where(user_links_table.c.user_id == user_id)
        )
        # Insert new links
        if links:
            values = [
                {"user_id": user_id, "title": link["title"], "url": link["url"]}
                for link in links
            ]
            await session.execute(insert(user_links_table).values(values))


class UserSecurityRepository:
    async def update_password_hash(
        self,
        session: AsyncSession,
        user_id: int,
        password_hash: str,
    ) -> None:
        await session.execute(
            update(users_table)
            .where(users_table.c.id == user_id)
            .values(password=password_hash)
        )

    async def revoke_refresh_tokens(self, session: AsyncSession, user_id: int) -> None:
        await session.execute(
            update(refresh_tokens_table)
            .where(
                refresh_tokens_table.c.user_id == user_id,
                refresh_tokens_table.c.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.utcnow())
        )

    async def create_refresh_token(
        self,
        session: AsyncSession,
        user_id: int,
        token_hash: str,
        expires_at: datetime,
    ) -> None:
        await session.execute(
            insert(refresh_tokens_table).values(
                user_id=user_id,
                token_hash=token_hash,
                expires_at=expires_at,
            )
        )
