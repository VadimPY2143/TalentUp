from __future__ import annotations

import os
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from .tasks import create_notification_task
from .repositories import NotificationRepository
from .service import NotificationService


async def dispatch_create_notification(
    session: AsyncSession,
    *,
    user_id: int,
    type: str,
    title: str,
    body: str | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    payload_json: dict[str, Any] | None = None,
    prefer_async: bool = False,
) -> dict[str, Any]:

    values = {
        "user_id": user_id,
        "type": type,
        "title": title,
        "body": body,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "payload_json": payload_json,
    }

    celery_enabled = (os.getenv("CELERY_ENABLED", "").strip() or "0") in ("1", "true", "True", "yes", "on")
    if prefer_async and celery_enabled:
        try:
            create_notification_task.delay(values)
            return {"enqueued": True, **values}
        except Exception:
            pass

    service = NotificationService(repository=NotificationRepository())
    return await service.create_notification(session=session, **values)

