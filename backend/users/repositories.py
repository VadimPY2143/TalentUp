from datetime import datetime
from typing import Any

from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import user_profiles_table


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
