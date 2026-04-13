from datetime import datetime, timedelta, timezone
import os
from typing import Any

from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import (
    vacancy_subscription_deliveries_table,
    vacancy_subscriptions_table,
)


def ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def subscription_interval() -> timedelta:
    minutes = 1
    if minutes <= 0:
        minutes = 1
    return timedelta(minutes=minutes)


class VacancySubscriptionRepository:
    async def create_subscription(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        email: str,
        search_text: str,
        filters: dict[str, Any],
        next_run_at: datetime,
        is_active: bool,
    ) -> dict[str, Any]:
        stmt = (
            insert(vacancy_subscriptions_table)
            .values(
                user_id=user_id,
                email=email,
                search_text=search_text,
                filters=filters,
                next_run_at=next_run_at,
                is_active=is_active,
            )
            .returning(*vacancy_subscriptions_table.c)
        )
        result = await session.execute(stmt)
        return dict(result.mappings().one())

    async def list_subscriptions_by_user(
        self,
        session: AsyncSession,
        *,
        user_id: int,
    ) -> list[dict[str, Any]]:
        stmt = (
            select(vacancy_subscriptions_table)
            .where(vacancy_subscriptions_table.c.user_id == user_id)
            .order_by(
                vacancy_subscriptions_table.c.created_at.desc(),
                vacancy_subscriptions_table.c.id.desc(),
            )
        )
        result = await session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    async def get_owned_subscription(
        self,
        session: AsyncSession,
        *,
        subscription_id: int,
        user_id: int,
    ) -> dict[str, Any] | None:
        stmt = select(vacancy_subscriptions_table).where(
            vacancy_subscriptions_table.c.id == subscription_id,
            vacancy_subscriptions_table.c.user_id == user_id,
        )
        result = await session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def update_owned_subscription(
        self,
        session: AsyncSession,
        *,
        subscription_id: int,
        user_id: int,
        values: dict[str, Any],
    ) -> dict[str, Any] | None:
        stmt = (
            update(vacancy_subscriptions_table)
            .where(
                vacancy_subscriptions_table.c.id == subscription_id,
                vacancy_subscriptions_table.c.user_id == user_id,
            )
            .values(**values, updated_at=datetime.now(timezone.utc))
            .returning(*vacancy_subscriptions_table.c)
        )
        result = await session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def delete_owned_subscription(
        self,
        session: AsyncSession,
        *,
        subscription_id: int,
        user_id: int,
    ) -> bool:
        stmt = (
            delete(vacancy_subscriptions_table)
            .where(
                vacancy_subscriptions_table.c.id == subscription_id,
                vacancy_subscriptions_table.c.user_id == user_id,
            )
            .returning(vacancy_subscriptions_table.c.id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def claim_due_deliveries(
        self,
        session: AsyncSession,
        *,
        now_utc: datetime,
        batch_size: int,
    ) -> list[int]:
        stmt = (
            select(vacancy_subscriptions_table)
            .where(
                vacancy_subscriptions_table.c.is_active.is_(True),
                vacancy_subscriptions_table.c.next_run_at <= now_utc,
            )
            .order_by(
                vacancy_subscriptions_table.c.next_run_at.asc(),
                vacancy_subscriptions_table.c.id.asc(),
            )
            .limit(batch_size)
            .with_for_update(skip_locked=True)
        )
        result = await session.execute(stmt)
        rows = [dict(row) for row in result.mappings().all()]
        if not rows:
            return []

        delivery_ids: list[int] = []
        interval = subscription_interval()
        next_run_at = now_utc + interval
        for row in rows:
            period_start = ensure_utc(row.get("last_processed_at")) or (now_utc - interval)
            delivery_stmt = (
                insert(vacancy_subscription_deliveries_table)
                .values(
                    subscription_id=row["id"],
                    period_start=period_start,
                    period_end=now_utc,
                    status="pending",
                )
                .returning(vacancy_subscription_deliveries_table.c.id)
            )
            delivery_id = (await session.execute(delivery_stmt)).scalar_one()
            delivery_ids.append(delivery_id)

            await session.execute(
                update(vacancy_subscriptions_table)
                .where(vacancy_subscriptions_table.c.id == row["id"])
                .values(next_run_at=next_run_at, updated_at=now_utc)
            )
        return delivery_ids

    async def list_pending_delivery_ids(
        self,
        session: AsyncSession,
        *,
        limit: int,
    ) -> list[int]:
        safe_limit = max(1, min(limit, 1000))
        stmt = (
            select(vacancy_subscription_deliveries_table.c.id)
            .where(vacancy_subscription_deliveries_table.c.status == "pending")
            .order_by(
                vacancy_subscription_deliveries_table.c.created_at.asc(),
                vacancy_subscription_deliveries_table.c.id.asc(),
            )
            .limit(safe_limit)
        )
        result = await session.execute(stmt)
        return [int(delivery_id) for delivery_id in result.scalars().all()]

    async def get_delivery_for_update(
        self,
        session: AsyncSession,
        *,
        delivery_id: int,
    ) -> dict[str, Any] | None:
        stmt = (
            select(vacancy_subscription_deliveries_table)
            .where(vacancy_subscription_deliveries_table.c.id == delivery_id)
            .with_for_update()
        )
        result = await session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def get_subscription_by_id(
        self,
        session: AsyncSession,
        *,
        subscription_id: int,
    ) -> dict[str, Any] | None:
        stmt = select(vacancy_subscriptions_table).where(vacancy_subscriptions_table.c.id == subscription_id)
        result = await session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def mark_delivery_sent(
        self,
        session: AsyncSession,
        *,
        delivery_id: int,
        vacancies_count: int,
        sent_at: datetime,
    ) -> None:
        await session.execute(
            update(vacancy_subscription_deliveries_table)
            .where(vacancy_subscription_deliveries_table.c.id == delivery_id)
            .values(
                status="sent",
                vacancies_count=vacancies_count,
                sent_at=sent_at,
                error=None,
            )
        )

    async def mark_delivery_skipped(
        self,
        session: AsyncSession,
        *,
        delivery_id: int,
        reason: str | None = None,
    ) -> None:
        await session.execute(
            update(vacancy_subscription_deliveries_table)
            .where(vacancy_subscription_deliveries_table.c.id == delivery_id)
            .values(
                status="skipped",
                vacancies_count=0,
                sent_at=None,
                error=reason,
            )
        )

    async def mark_delivery_failed(
        self,
        session: AsyncSession,
        *,
        delivery_id: int,
        error: str,
    ) -> None:
        await session.execute(
            update(vacancy_subscription_deliveries_table)
            .where(vacancy_subscription_deliveries_table.c.id == delivery_id)
            .values(status="failed", error=error[:2000])
        )

    async def update_subscription_progress(
        self,
        session: AsyncSession,
        *,
        subscription_id: int,
        period_end: datetime,
        sent_at: datetime | None,
    ) -> None:
        values: dict[str, Any] = {
            "last_processed_at": period_end,
            "updated_at": datetime.now(timezone.utc),
        }
        if sent_at is not None:
            values["last_sent_at"] = sent_at
        await session.execute(
            update(vacancy_subscriptions_table)
            .where(vacancy_subscriptions_table.c.id == subscription_id)
            .values(**values)
        )
