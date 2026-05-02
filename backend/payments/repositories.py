from typing import Any

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from database import credit_packages_table, credit_transactions_table, payment_orders_table


class PaymentsRepository:
    async def list_active_packages(self, session: AsyncSession) -> list[dict[str, Any]]:
        stmt = (
            select(credit_packages_table)
            .where(credit_packages_table.c.is_active.is_(True))
            .order_by(credit_packages_table.c.credits.asc())
        )
        rows = (await session.execute(stmt)).mappings().all()
        return [dict(row) for row in rows]

    async def get_package_by_code(self, session: AsyncSession, code: str) -> dict[str, Any] | None:
        stmt = select(credit_packages_table).where(credit_packages_table.c.code == code)
        row = (await session.execute(stmt)).mappings().first()
        return dict(row) if row else None

    async def get_package_by_id(self, session: AsyncSession, package_id: int) -> dict[str, Any] | None:
        stmt = select(credit_packages_table).where(credit_packages_table.c.id == package_id)
        row = (await session.execute(stmt)).mappings().first()
        return dict(row) if row else None

    async def get_order_by_idempotency_key(
        self,
        session: AsyncSession,
        idempotency_key: str,
    ) -> dict[str, Any] | None:
        stmt = select(payment_orders_table).where(payment_orders_table.c.idempotency_key == idempotency_key)
        row = (await session.execute(stmt)).mappings().first()
        return dict(row) if row else None

    async def create_order(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        package_id: int,
        provider: str,
        provider_order_id: str,
        amount_uah: int,
        idempotency_key: str,
    ) -> tuple[dict[str, Any], bool]:
        stmt = (
            pg_insert(payment_orders_table)
            .values(
                user_id=user_id,
                package_id=package_id,
                provider=provider,
                provider_order_id=provider_order_id,
                amount_uah=amount_uah,
                status="pending",
                idempotency_key=idempotency_key,
            )
            .on_conflict_do_nothing(
                index_elements=[payment_orders_table.c.idempotency_key]
            )
            .returning(*payment_orders_table.c)
        )
        row = (await session.execute(stmt)).mappings().first()
        if row:
            return dict(row), True

        existing = await self.get_order_by_idempotency_key(
            session=session,
            idempotency_key=idempotency_key,
        )
        if existing:
            return existing, False

        raise RuntimeError("Failed to create payment order")

    async def get_order_by_provider_order_id_for_update(
        self,
        session: AsyncSession,
        provider_order_id: str,
        provider: str | None = None,
    ) -> dict[str, Any] | None:
        stmt = select(payment_orders_table).where(payment_orders_table.c.provider_order_id == provider_order_id)
        if provider:
            stmt = stmt.where(payment_orders_table.c.provider == provider)
        stmt = stmt.with_for_update()
        row = (await session.execute(stmt)).mappings().first()
        return dict(row) if row else None

    async def update_order_status(
        self,
        session: AsyncSession,
        *,
        order_id: int,
        status: str,
        provider_payload: dict[str, Any],
        paid_at: Any = None,
    ) -> None:
        values: dict[str, Any] = {
            "status": status,
            "provider_payload": provider_payload,
        }
        if paid_at is not None:
            values["paid_at"] = paid_at

        await session.execute(
            update(payment_orders_table)
            .where(payment_orders_table.c.id == order_id)
            .values(**values)
        )

    async def list_credit_transactions(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        limit: int,
        offset: int,
    ) -> list[dict[str, Any]]:
        stmt = (
            select(credit_transactions_table)
            .where(credit_transactions_table.c.user_id == user_id)
            .order_by(credit_transactions_table.c.id.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = (await session.execute(stmt)).mappings().all()
        return [dict(row) for row in rows]

    async def list_pending_orders_for_user(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        provider: str = "wayforpay",
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        stmt = (
            select(payment_orders_table)
            .where(
                payment_orders_table.c.user_id == user_id,
                payment_orders_table.c.status == "pending",
                payment_orders_table.c.provider == provider,
            )
            .order_by(payment_orders_table.c.id.desc())
            .limit(limit)
        )
        rows = (await session.execute(stmt)).mappings().all()
        return [dict(row) for row in rows]
