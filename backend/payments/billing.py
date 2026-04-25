from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from database import credit_transactions_table, users_table


RESUME_SUMMARY_CREDITS = 4
VACANCY_AI_FILL_CREDITS = 12
MATCHING_PER_CANDIDATE_CREDITS = 2


def get_candidate_matching_credits(analyzed_candidates: int) -> int:
    if analyzed_candidates <= 0:
        return 0
    return MATCHING_PER_CANDIDATE_CREDITS * analyzed_candidates


@dataclass(slots=True)
class ChargeResult:
    charged: bool
    balance_after: int


class CreditBillingService:
    async def _get_existing_balance_after(
        self,
        *,
        session: AsyncSession,
        idempotency_key: str,
    ) -> int | None:
        existing_stmt = select(credit_transactions_table.c.balance_after).where(
            credit_transactions_table.c.idempotency_key == idempotency_key
        )
        existing = (await session.execute(existing_stmt)).mappings().first()
        if not existing:
            return None
        return int(existing["balance_after"])

    async def _lock_user_credits(
        self,
        *,
        session: AsyncSession,
        user_id: int,
    ) -> int:
        user_lock_stmt = (
            select(users_table.c.id, users_table.c.credits)
            .where(users_table.c.id == user_id)
            .with_for_update()
        )
        user_row = (await session.execute(user_lock_stmt)).mappings().first()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")
        return int(user_row["credits"])

    async def get_balance(self, session: AsyncSession, user_id: int) -> int:
        stmt = select(users_table.c.credits).where(users_table.c.id == user_id)
        credits = (await session.execute(stmt)).scalar_one_or_none()
        if credits is None:
            raise HTTPException(status_code=404, detail="User not found")
        return int(credits)

    async def ensure_sufficient_credits(
        self,
        session: AsyncSession,
        user_id: int,
        required_credits: int,
    ) -> int:
        current = await self.get_balance(session=session, user_id=user_id)
        if current < required_credits:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "message": "Not enough credits",
                    "required_credits": required_credits,
                    "current_credits": current,
                },
            )
        return current

    async def charge_for_feature(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        feature_code: str,
        amount: int,
        idempotency_key: str,
        reference_type: str | None = None,
        reference_id: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> ChargeResult:
        if amount <= 0:
            raise ValueError("amount must be positive")

        existing_balance = await self._get_existing_balance_after(
            session=session,
            idempotency_key=idempotency_key,
        )
        if existing_balance is not None:
            return ChargeResult(charged=False, balance_after=existing_balance)

        current_credits = await self._lock_user_credits(session=session, user_id=user_id)

        existing_balance = await self._get_existing_balance_after(
            session=session,
            idempotency_key=idempotency_key,
        )
        if existing_balance is not None:
            return ChargeResult(charged=False, balance_after=existing_balance)

        if current_credits < amount:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "message": "Not enough credits",
                    "required_credits": amount,
                    "current_credits": current_credits,
                },
            )

        balance_after = current_credits - amount

        inserted_balance = (
            await session.execute(
                pg_insert(credit_transactions_table)
                .values(
                    user_id=user_id,
                    type="debit",
                    amount=-amount,
                    balance_after=balance_after,
                    feature_code=feature_code,
                    reference_type=reference_type,
                    reference_id=reference_id,
                    idempotency_key=idempotency_key,
                    meta=meta or {},
                )
                .on_conflict_do_nothing(
                    index_elements=[credit_transactions_table.c.idempotency_key]
                )
                .returning(credit_transactions_table.c.balance_after)
            )
        ).scalar_one_or_none()
        if inserted_balance is None:
            existing_balance = await self._get_existing_balance_after(
                session=session,
                idempotency_key=idempotency_key,
            )
            if existing_balance is None:
                raise RuntimeError("Failed to apply debit transaction")
            return ChargeResult(charged=False, balance_after=existing_balance)

        await session.execute(
            update(users_table)
            .where(users_table.c.id == user_id)
            .values(credits=int(inserted_balance))
        )
        return ChargeResult(charged=True, balance_after=int(inserted_balance))

    async def refund_feature_charge(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        amount: int,
        idempotency_key: str,
        feature_code: str,
        reference_type: str | None = None,
        reference_id: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> ChargeResult:
        if amount <= 0:
            raise ValueError("amount must be positive")

        existing_balance = await self._get_existing_balance_after(
            session=session,
            idempotency_key=idempotency_key,
        )
        if existing_balance is not None:
            return ChargeResult(charged=False, balance_after=existing_balance)

        current_credits = await self._lock_user_credits(session=session, user_id=user_id)

        existing_balance = await self._get_existing_balance_after(
            session=session,
            idempotency_key=idempotency_key,
        )
        if existing_balance is not None:
            return ChargeResult(charged=False, balance_after=existing_balance)

        balance_after = current_credits + amount

        inserted_balance = (
            await session.execute(
                pg_insert(credit_transactions_table)
                .values(
                    user_id=user_id,
                    type="refund",
                    amount=amount,
                    balance_after=balance_after,
                    feature_code=feature_code,
                    reference_type=reference_type,
                    reference_id=reference_id,
                    idempotency_key=idempotency_key,
                    meta=meta or {},
                )
                .on_conflict_do_nothing(
                    index_elements=[credit_transactions_table.c.idempotency_key]
                )
                .returning(credit_transactions_table.c.balance_after)
            )
        ).scalar_one_or_none()
        if inserted_balance is None:
            existing_balance = await self._get_existing_balance_after(
                session=session,
                idempotency_key=idempotency_key,
            )
            if existing_balance is None:
                raise RuntimeError("Failed to apply refund transaction")
            return ChargeResult(charged=False, balance_after=existing_balance)

        await session.execute(
            update(users_table)
            .where(users_table.c.id == user_id)
            .values(credits=int(inserted_balance))
        )
        return ChargeResult(charged=True, balance_after=int(inserted_balance))

    async def apply_purchase(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        credits: int,
        idempotency_key: str,
        reference_type: str = "payment_order",
        reference_id: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> ChargeResult:
        if credits <= 0:
            raise ValueError("credits must be positive")

        existing_balance = await self._get_existing_balance_after(
            session=session,
            idempotency_key=idempotency_key,
        )
        if existing_balance is not None:
            return ChargeResult(charged=False, balance_after=existing_balance)

        current_credits = await self._lock_user_credits(session=session, user_id=user_id)

        existing_balance = await self._get_existing_balance_after(
            session=session,
            idempotency_key=idempotency_key,
        )
        if existing_balance is not None:
            return ChargeResult(charged=False, balance_after=existing_balance)

        balance_after = current_credits + credits

        inserted_balance = (
            await session.execute(
                pg_insert(credit_transactions_table)
                .values(
                    user_id=user_id,
                    type="purchase",
                    amount=credits,
                    balance_after=balance_after,
                    feature_code=None,
                    reference_type=reference_type,
                    reference_id=reference_id,
                    idempotency_key=idempotency_key,
                    meta=meta or {},
                )
                .on_conflict_do_nothing(
                    index_elements=[credit_transactions_table.c.idempotency_key]
                )
                .returning(credit_transactions_table.c.balance_after)
            )
        ).scalar_one_or_none()
        if inserted_balance is None:
            existing_balance = await self._get_existing_balance_after(
                session=session,
                idempotency_key=idempotency_key,
            )
            if existing_balance is None:
                raise RuntimeError("Failed to apply purchase transaction")
            return ChargeResult(charged=False, balance_after=existing_balance)

        await session.execute(
            update(users_table)
            .where(users_table.c.id == user_id)
            .values(credits=int(inserted_balance))
        )
        return ChargeResult(charged=True, balance_after=int(inserted_balance))
