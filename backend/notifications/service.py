from __future__ import annotations

import base64
import json
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from .repositories import NotificationRepository


def _encode_cursor(created_at: datetime, notification_id: int) -> str:
    raw = json.dumps({"created_at": created_at.isoformat(), "id": notification_id}, separators=(",", ":")).encode(
        "utf-8"
    )
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_cursor(cursor: str) -> tuple[datetime, int]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        decoded = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
        data = json.loads(decoded)
        created_at = datetime.fromisoformat(str(data["created_at"]))
        notification_id = int(data["id"])
        return created_at, notification_id
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid cursor") from exc


class NotificationService:
    def __init__(self, repository: NotificationRepository) -> None:
        self.repository = repository

    async def create_notification(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        type: str,
        title: str,
        body: str | None = None,
        entity_type: str | None = None,
        entity_id: int | None = None,
        payload_json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        values: dict[str, Any] = {
            "user_id": user_id,
            "type": type,
            "title": title,
            "body": body,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "payload_json": payload_json,
        }
        row = await self.repository.insert_notification(session=session, values=values)
        await session.commit()
        return row

    async def list_notifications(
        self,
        session: AsyncSession,
        user_id: int,
        limit: int,
        cursor: str | None,
    ) -> tuple[list[dict[str, Any]], str | None]:
        cursor_created_at: datetime | None = None
        cursor_id: int | None = None
        if cursor:
            cursor_created_at, cursor_id = _decode_cursor(cursor)

        rows = await self.repository.fetch_notifications(
            session=session,
            user_id=user_id,
            limit=limit,
            cursor_created_at=cursor_created_at,
            cursor_id=cursor_id,
        )

        next_cursor = None
        if len(rows) == limit:
            last = rows[-1]
            if isinstance(last.get("created_at"), datetime) and isinstance(last.get("id"), int):
                next_cursor = _encode_cursor(last["created_at"], last["id"])

        return rows, next_cursor

    async def mark_read(self, session: AsyncSession, notification_id: int, user_id: int) -> None:
        changed = await self.repository.mark_read(session=session, notification_id=notification_id, user_id=user_id)
        if not changed:
            exists = await self.repository.exists_for_user(session=session, notification_id=notification_id, user_id=user_id)
            if not exists:
                raise HTTPException(status_code=404, detail="Notification not found")
        await session.commit()

    async def mark_all_read(self, session: AsyncSession, user_id: int) -> int:
        changed = await self.repository.mark_all_read(session=session, user_id=user_id)
        await session.commit()
        return changed

    async def get_unread_count(self, session: AsyncSession, user_id: int) -> int:
        return await self.repository.count_unread(session=session, user_id=user_id)
