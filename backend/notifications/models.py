from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NotificationOut(BaseModel):
    id: int
    user_id: int
    type: str = Field(max_length=100)
    title: str = Field(max_length=255)
    body: str | None = None
    entity_type: str | None = Field(default=None, max_length=100)
    entity_id: int | None = None
    payload_json: dict[str, Any] | None = None
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: list[NotificationOut]
    next_cursor: str | None = None


class UnreadCountResponse(BaseModel):
    unread_count: int

