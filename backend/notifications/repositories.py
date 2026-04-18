from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import and_, desc, func, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import notifications_table


class NotificationRepository:
    async def insert_notification(
        self,
        session: AsyncSession,
        values: dict[str, Any],
    ) -> dict[str, Any]:
        stmt = insert(notifications_table).values(**values).returning(*notifications_table.c)
        result = await session.execute(stmt)
        return dict(result.mappings().one())

    async def fetch_notifications(
        self,
        session: AsyncSession,
        user_id: int,
        limit: int,
        cursor_created_at: datetime | None,
        cursor_id: int | None,
    ) -> list[dict[str, Any]]:
        stmt = select(notifications_table).where(notifications_table.c.user_id == user_id)
        if cursor_created_at is not None and cursor_id is not None:
            stmt = stmt.where(
                or_(
                    notifications_table.c.created_at < cursor_created_at,
                    and_(
                        notifications_table.c.created_at == cursor_created_at,
                        notifications_table.c.id < cursor_id,
                    ),
                )
            )

        stmt = stmt.order_by(desc(notifications_table.c.created_at), desc(notifications_table.c.id)).limit(limit)
        result = await session.execute(stmt)
        return [dict(r) for r in result.mappings().all()]

    async def mark_read(
        self,
        session: AsyncSession,
        notification_id: int,
        user_id: int,
    ) -> bool:
        stmt = (
            update(notifications_table)
            .where(
                notifications_table.c.id == notification_id,
                notifications_table.c.user_id == user_id,
                notifications_table.c.is_read.is_(False),
            )
            .values(is_read=True, read_at=func.now())
        )
        result = await session.execute(stmt)
        return bool(result.rowcount)

    async def exists_for_user(self, session: AsyncSession, notification_id: int, user_id: int) -> bool:
        stmt = select(notifications_table.c.id).where(
            notifications_table.c.id == notification_id,
            notifications_table.c.user_id == user_id,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def mark_all_read(self, session: AsyncSession, user_id: int) -> int:
        stmt = (
            update(notifications_table)
            .where(
                notifications_table.c.user_id == user_id,
                notifications_table.c.is_read.is_(False),
            )
            .values(is_read=True, read_at=func.now())
        )
        result = await session.execute(stmt)
        return int(result.rowcount or 0)

    async def count_unread(self, session: AsyncSession, user_id: int) -> int:
        stmt = select(func.count()).select_from(notifications_table).where(
            notifications_table.c.user_id == user_id,
            notifications_table.c.is_read.is_(False),
        )
        result = await session.execute(stmt)
        return int(result.scalar_one())
