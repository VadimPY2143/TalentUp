import asyncio
from datetime import datetime, timezone
import logging
import os
from typing import Coroutine, TypeVar

from database import async_session_factory

from .celery_app import celery_app
from .repositories import VacancySubscriptionRepository
from .services import VacancyDigestService
from .smtp import SMTPPermanentError, SMTPTemporaryError, send_smtp_email

LOGGER = logging.getLogger(__name__)
_T = TypeVar("_T")
_EVENT_LOOP: asyncio.AbstractEventLoop | None = None
SMTP_MAX_RETRIES = int(os.getenv("SMTP_MAX_RETRIES", "5"))
SMTP_RETRY_BASE_DELAY_SECONDS = int(os.getenv("SMTP_RETRY_BASE_DELAY_SECONDS", "10"))
SMTP_RETRY_MAX_DELAY_SECONDS = int(os.getenv("SMTP_RETRY_MAX_DELAY_SECONDS", "300"))


def _run_async(coro: Coroutine[object, object, _T]) -> _T:
    global _EVENT_LOOP
    if _EVENT_LOOP is None or _EVENT_LOOP.is_closed():
        _EVENT_LOOP = asyncio.new_event_loop()
    asyncio.set_event_loop(_EVENT_LOOP)
    return _EVENT_LOOP.run_until_complete(coro)


def _retry_delay_seconds(retries: int) -> int:
    return min(
        SMTP_RETRY_MAX_DELAY_SECONDS,
        SMTP_RETRY_BASE_DELAY_SECONDS * (2 ** max(retries, 0)),
    )


async def _mark_delivery_failed_async(delivery_id: int, error: str) -> None:
    repository = VacancySubscriptionRepository()
    async with async_session_factory() as session:
        await repository.mark_delivery_failed(
            session=session,
            delivery_id=delivery_id,
            error=error,
        )
        await session.commit()


@celery_app.task(name="worker.messages.tasks.dispatch_due_subscriptions")
def dispatch_due_subscriptions(batch_size: int = 100) -> int:
    return _run_async(_dispatch_due_subscriptions(batch_size=batch_size))


async def _dispatch_due_subscriptions(batch_size: int) -> int:
    now_utc = datetime.now(timezone.utc)
    repository = VacancySubscriptionRepository()
    async with async_session_factory() as session:
        claimed_delivery_ids = await repository.claim_due_deliveries(
            session=session,
            now_utc=now_utc,
            batch_size=batch_size,
        )
        # Re-queue pending deliveries to recover from crashes/restarts between DB commit and task publish.
        pending_delivery_ids = await repository.list_pending_delivery_ids(
            session=session,
            limit=max(batch_size * 5, 100),
        )
        await session.commit()

    delivery_ids = sorted(set(claimed_delivery_ids + pending_delivery_ids))
    for delivery_id in delivery_ids:
        send_subscription_digest.delay(delivery_id)
    if delivery_ids:
        LOGGER.info(
            "Queued %s vacancy digest deliveries (%s new, %s pending)",
            len(delivery_ids),
            len(claimed_delivery_ids),
            len(pending_delivery_ids),
        )
    return len(delivery_ids)


@celery_app.task(
    bind=True,
    name="worker.messages.tasks.send_subscription_digest",
)
def send_subscription_digest(self, delivery_id: int) -> str:
    try:
        return _run_async(_send_subscription_digest(delivery_id=delivery_id))
    except SMTPTemporaryError as exc:
        retries = int(getattr(self.request, "retries", 0))
        if retries >= SMTP_MAX_RETRIES:
            _run_async(
                _mark_delivery_failed_async(
                    delivery_id=delivery_id,
                    error=f"Temporary SMTP error after retries: {exc}",
                )
            )
            return "smtp_failed_temporary"

        countdown = _retry_delay_seconds(retries)
        raise self.retry(
            exc=exc,
            countdown=countdown,
            max_retries=SMTP_MAX_RETRIES,
        )


async def _send_subscription_digest(delivery_id: int) -> str:
    repository = VacancySubscriptionRepository()
    digest_service = VacancyDigestService()
    async with async_session_factory() as session:
        delivery = await repository.get_delivery_for_update(session=session, delivery_id=delivery_id)
        if not delivery:
            return "delivery_not_found"

        if delivery["status"] in {"sent", "skipped"}:
            return delivery["status"]

        subscription = await repository.get_subscription_by_id(
            session=session,
            subscription_id=delivery["subscription_id"],
        )
        if not subscription:
            await repository.mark_delivery_failed(
                session=session,
                delivery_id=delivery_id,
                error="Subscription not found",
            )
            await session.commit()
            return "subscription_not_found"

        if not subscription.get("is_active", False):
            await repository.mark_delivery_skipped(
                session=session,
                delivery_id=delivery_id,
                reason="Subscription is inactive",
            )
            await repository.update_subscription_progress(
                session=session,
                subscription_id=subscription["id"],
                period_end=delivery["period_end"],
                sent_at=None,
            )
            await session.commit()
            return "inactive"

        try:
            vacancies = await digest_service.find_new_vacancies(
                session=session,
                subscription=subscription,
                period_start=delivery["period_start"],
                period_end=delivery["period_end"],
            )
        except Exception as exc:  # noqa: BLE001
            await repository.mark_delivery_failed(
                session=session,
                delivery_id=delivery_id,
                error=f"Invalid subscription filters or query error: {exc}",
            )
            await session.commit()
            return "invalid_filters"

        if not vacancies:
            await repository.mark_delivery_skipped(
                session=session,
                delivery_id=delivery_id,
                reason="No new vacancies for this period",
            )
            await repository.update_subscription_progress(
                session=session,
                subscription_id=subscription["id"],
                period_end=delivery["period_end"],
                sent_at=None,
            )
            await session.commit()
            return "no_vacancies"

        subject = digest_service.build_subject(subscription["search_text"], len(vacancies))
        text_body = digest_service.build_text_body(
            subscription["search_text"],
            vacancies,
            delivery["period_start"],
            delivery["period_end"],
        )
        html_body = digest_service.build_html_body(
            subscription["search_text"],
            vacancies,
            delivery["period_start"],
            delivery["period_end"],
        )

        try:
            send_smtp_email(
                to_email=subscription["email"],
                subject=subject,
                text_body=text_body,
                html_body=html_body,
            )
        except SMTPTemporaryError:
            raise
        except SMTPPermanentError as exc:
            await repository.mark_delivery_failed(
                session=session,
                delivery_id=delivery_id,
                error=f"Permanent SMTP error: {exc}",
            )
            await session.commit()
            return "smtp_failed_permanent"
        except Exception as exc:  # noqa: BLE001
            await repository.mark_delivery_failed(
                session=session,
                delivery_id=delivery_id,
                error=f"Unexpected delivery error: {exc}",
            )
            await session.commit()
            return "delivery_failed"

        sent_at = datetime.now(timezone.utc)
        await repository.mark_delivery_sent(
            session=session,
            delivery_id=delivery_id,
            vacancies_count=len(vacancies),
            sent_at=sent_at,
        )
        await repository.update_subscription_progress(
            session=session,
            subscription_id=subscription["id"],
            period_end=delivery["period_end"],
            sent_at=sent_at,
        )
        await session.commit()
        return "sent"
