from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from celery import Celery

from database import async_session_factory
from .repositories import NotificationRepository
from .service import NotificationService


def _celery_broker_url() -> str:
    return os.getenv("CELERY_BROKER_URL") or os.getenv("REDIS_URL", "redis://localhost:6379/0")


celery_app = Celery("notifications", broker=_celery_broker_url())
celery_app.conf.result_backend = os.getenv("CELERY_RESULT_BACKEND") or _celery_broker_url()
app = celery_app  # celery -A notifications.tasks worker


@celery_app.task(name="notifications.create_notification")
def create_notification_task(values: dict[str, Any]) -> dict[str, Any]:
    async def _run() -> dict[str, Any]:
        async with async_session_factory() as session:
            service = NotificationService(repository=NotificationRepository())
            row = await service.create_notification(session=session, **values)

        # Publish realtime event outside of the DB session.
        try:
            import redis.asyncio as redis

            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            client = redis.from_url(redis_url, decode_responses=True)
            await client.publish(
                f"notif:{int(row['user_id'])}",
                json.dumps({"type": "notification_created", "notification": row}, default=str),
            )
            await client.aclose()
        except Exception:
            pass

        return row

    return asyncio.run(_run())
