from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Query, Response, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from logger import logger
from users.auth import get_current_user, get_current_user_by_token

from .connection_manager import manager
from .models import NotificationListResponse, NotificationOut, UnreadCountResponse
from .repositories import NotificationRepository
from .realtime import redis_client, relay_pubsub_events_to_local_sockets
from .service import NotificationService


router = APIRouter(tags=["Notifications"], prefix="/notifications")
service = NotificationService(repository=NotificationRepository())

_listener_task: asyncio.Task[None] | None = None
_listener_stop = asyncio.Event()


@router.on_event("startup")
async def _start_notifications_pubsub_listener() -> None:
    global _listener_task
    if _listener_task is None or _listener_task.done():
        _listener_stop.clear()
        _listener_task = asyncio.create_task(
            relay_pubsub_events_to_local_sockets(send_to_user=manager.send_to_user, stop_event=_listener_stop)
        )


@router.on_event("shutdown")
async def _stop_notifications_pubsub_listener() -> None:
    global _listener_task
    _listener_stop.set()
    if _listener_task is not None:
        _listener_task.cancel()
        try:
            await _listener_task
        except asyncio.CancelledError:
            pass
        _listener_task = None
    await redis_client.aclose()


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> NotificationListResponse:
    rows, next_cursor = await service.list_notifications(
        session=session,
        user_id=current_user["id"],
        limit=limit,
        cursor=cursor,
    )
    return NotificationListResponse(
        notifications=[NotificationOut(**row) for row in rows],
        next_cursor=next_cursor,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    session: AsyncSession = Depends(get_session),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> UnreadCountResponse:
    unread = await service.get_unread_count(session=session, user_id=current_user["id"])
    return UnreadCountResponse(unread_count=unread)


@router.patch("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    notification_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Response:
    await service.mark_read(session=session, notification_id=notification_id, user_id=current_user["id"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    session: AsyncSession = Depends(get_session),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Response:
    await service.mark_all_read(session=session, user_id=current_user["id"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.websocket("/ws")
async def notifications_ws(websocket: WebSocket, session: AsyncSession = Depends(get_session)) -> None:
    token = websocket.query_params.get("token") or websocket.headers.get("authorization")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        user = await get_current_user_by_token(token, session)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(user["id"], websocket)
    logger.info(f"User {user['id']} connected to notifications ws")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(user["id"], websocket)
