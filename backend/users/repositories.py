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
