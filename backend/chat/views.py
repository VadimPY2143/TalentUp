import asyncio
import json
import os
from datetime import datetime
from typing import Any

import redis.asyncio as redis
from redis.exceptions import RedisError
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from .connection_manager import manager
from .models import (
    ChatCreateRequest,
    ChatMessagesListResponse,
    ChatResumeResponse,
    ChatResponse,
    ChatUnreadCountersResponse,
    MyChatsListResponse,
    WebSocketIncomingMessage,
)
from .repositories import ChatRepository
from .services import ChatService
from database import get_session
from logger import logger
from users.auth import get_current_user, get_current_user_by_token
from users.define_roles import require_roles


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)
redis_listener_task: asyncio.Task[None] | None = None

router = APIRouter(
    tags=["Chat"],
    prefix="/chat",
)
chat_service = ChatService(repository=ChatRepository())


async def _relay_pubsub_events_to_local_sockets() -> None:
    while True:
        pubsub = redis_client.pubsub()
        try:
            await pubsub.psubscribe("user:*")
            async for event in pubsub.listen():
                if event.get("type") != "pmessage":
                    continue

                channel = event.get("channel")
                if not isinstance(channel, str) or not channel.startswith("user:"):
                    continue

                user_id_raw = channel.split(":", 1)[1]
                if not user_id_raw.isdigit():
                    continue

                raw_payload = event.get("data")
                if not isinstance(raw_payload, str):
                    continue

                try:
                    payload = json.loads(raw_payload)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid Redis pubsub payload on channel {channel}")
                    continue

                if not isinstance(payload, dict):
                    continue

                await manager.send_to_user(int(user_id_raw), payload)
        except asyncio.CancelledError:
            raise
        except RedisError as exc:
            logger.error(f"Redis pubsub listener error: {exc}")
            await asyncio.sleep(1)
        except Exception as exc:
            logger.error(f"Unexpected pubsub listener error: {exc}")
            await asyncio.sleep(1)
        finally:
            await pubsub.aclose()


@router.on_event("startup")
async def _start_redis_pubsub_listener() -> None:
    global redis_listener_task
    if redis_listener_task is None or redis_listener_task.done():
        redis_listener_task = asyncio.create_task(_relay_pubsub_events_to_local_sockets())


@router.on_event("shutdown")
async def _stop_redis_pubsub_listener() -> None:
    global redis_listener_task
    if redis_listener_task is not None:
        redis_listener_task.cancel()
        try:
            await redis_listener_task
        except asyncio.CancelledError:
            pass
        redis_listener_task = None
    await redis_client.aclose()

@router.post("", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
async def create_chat(
    payload: ChatCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: dict[str, Any] = Depends(require_roles(["employer"])),
) -> ChatResponse:
    chat = await chat_service.create_chat(
        session=session,
        vacancy_id=payload.vacancy_id,
        employer_user_id=current_user["id"],
        resume_id=payload.resume_id,
    )
    return chat


@router.get("/my", response_model=MyChatsListResponse)
async def get_my_chats(
    session: AsyncSession = Depends(get_session),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> MyChatsListResponse:
    chats = await chat_service.list_my_chats(session=session, user_id=current_user["id"])
    return MyChatsListResponse(chats=chats)


@router.get("/unread-counters", response_model=ChatUnreadCountersResponse)
async def get_unread_counters(
    session: AsyncSession = Depends(get_session),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> ChatUnreadCountersResponse:
    return await chat_service.get_unread_counters(session=session, user_id=current_user["id"])


@router.get("/{chat_id}/messages", response_model=ChatMessagesListResponse)
async def get_messages(
    chat_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> ChatMessagesListResponse:
    chat = await chat_service.get_chat_or_404(session=session, chat_id=chat_id)
    await chat_service.ensure_chat_member_or_403(
        session=session,
        chat_id=chat["id"],
        user_id=current_user["id"],
    )
    await chat_service.mark_chat_as_read(
        session=session,
        chat_id=chat["id"],
        reader_user_id=current_user["id"],
    )
    messages = await chat_service.list_messages(
        session=session,
        chat_id=chat_id,
        limit=limit,
        offset=offset,
    )
    return ChatMessagesListResponse(messages=messages)


@router.get("/{chat_id}/resume", response_model=ChatResumeResponse)
async def get_chat_worker_resume(
    chat_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict[str, Any] = Depends(require_roles(["employer"])),
) -> ChatResumeResponse:
    chat = await chat_service.get_chat_or_404(session=session, chat_id=chat_id)
    await chat_service.ensure_chat_member_or_403(
        session=session,
        chat_id=chat["id"],
        user_id=current_user["id"],
    )
    return await chat_service.get_chat_resume(
        session=session,
        chat=chat,
    )


@router.websocket("/ws/{chat_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    chat_id: int,
    session: AsyncSession = Depends(get_session),
) -> None:
    token = websocket.query_params.get("token") or websocket.headers.get("authorization")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        user = await get_current_user_by_token(token=token, session=session)
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        chat = await chat_service.get_chat_or_404(session=session, chat_id=chat_id)
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        await chat_service.ensure_chat_member_or_403(
            session=session,
            chat_id=chat_id,
            user_id=user["id"],
        )
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    member_ids = await chat_service.get_chat_member_ids(session=session, chat_id=chat_id)
    other_member_ids = [member_id for member_id in member_ids if member_id != user["id"]]

    await manager.connect(user["id"], websocket)
    logger.info(f"User {user['id']} connected to chat {chat_id}")
    await redis_client.set(f"online:{user['id']}", "1", ex=60)

    now_iso = datetime.utcnow().isoformat()
    for other_id in other_member_ids:
        await redis_client.publish(
            f"user:{other_id}",
            json.dumps(
                {
                    "type": "presence",
                    "chat_id": chat_id,
                    "user_id": user["id"],
                    "status": "online",
                    "timestamp": now_iso,
                }
            ),
        )

        other_online = await redis_client.exists(f"online:{other_id}")
        await manager.send_to_user(
            user["id"],
            {
                "type": "presence",
                "chat_id": chat_id,
                "user_id": other_id,
                "status": "online" if other_online else "offline",
                "timestamp": now_iso,
            },
        )

    try:
        while True:
            raw_message = await websocket.receive_text()
            try:
                payload = json.loads(raw_message)
            except json.JSONDecodeError:
                await manager.send_to_user(
                    user["id"],
                    {"type": "error", "code": "invalid_json", "detail": "Invalid JSON payload"},
                )
                continue

            if payload.get("type") == "ping":
                await redis_client.set(f"online:{user['id']}", "1", ex=60)
                await manager.send_to_user(user["id"], {"type": "pong"})
                continue

            if payload.get("type") != "message":
                await manager.send_to_user(
                    user["id"],
                    {"type": "error", "code": "unsupported_type", "detail": "Unsupported message type"},
                )
                continue

            try:
                parsed = WebSocketIncomingMessage(
                    text=(payload.get("text") or "").strip(),
                    to_user_id=payload.get("to_user_id"),
                )
            except ValidationError:
                await manager.send_to_user(
                    user["id"],
                    {"type": "error", "code": "invalid_message", "detail": "Message is invalid"},
                )
                continue

            to_user_id = parsed.to_user_id
            if to_user_id is None:
                to_user_id = other_member_ids[0] if other_member_ids else user["id"]

            if to_user_id not in member_ids:
                await manager.send_to_user(
                    user["id"],
                    {"type": "error", "code": "invalid_recipient", "detail": "Recipient is not in chat"},
                )
                continue

            try:
                await chat_service.ensure_first_message_rule(
                    session=session,
                    chat_id=chat_id,
                    sender_user_id=user["id"],
                    employer_user_id=chat["employer_user_id"],
                )
            except HTTPException:
                await manager.send_to_user(
                    user["id"],
                    {
                        "type": "error",
                        "code": "first_message_restricted",
                        "detail": "First message can be sent only by employer",
                    },
                )
                continue

            created_message = await chat_service.create_message(
                session=session,
                chat_id=chat_id,
                sender_user_id=user["id"],
                text=parsed.text,
            )

            message_payload = {
                "type": "message",
                "id": created_message["id"],
                "chat_id": chat_id,
                "from_user_id": user["id"],
                "to_user_id": to_user_id,
                "text": created_message["message"],
                "created_at": created_message["created_at"].isoformat(),
            }

            target_user_ids = {to_user_id, user["id"]}
            for target_user_id in target_user_ids:
                await redis_client.publish(f"user:{target_user_id}", json.dumps(message_payload))
    except WebSocketDisconnect:
        logger.info(f"User {user['id']} disconnected from chat {chat_id}")
    finally:
        await redis_client.delete(f"online:{user['id']}")
        disconnect_payload = {
            "type": "presence",
            "chat_id": chat_id,
            "user_id": user["id"],
            "status": "offline",
            "timestamp": datetime.utcnow().isoformat(),
        }
        for other_id in other_member_ids:
            await redis_client.publish(f"user:{other_id}", json.dumps(disconnect_payload))
        await manager.disconnect(user["id"], websocket)
