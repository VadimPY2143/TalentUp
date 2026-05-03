from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from .dispatch import dispatch_create_notification
from .realtime import publish_to_user


async def _create_and_publish(
    session: AsyncSession,
    *,
    user_id: int,
    type: str,
    title: str,
    body: str | None,
    entity_type: str | None,
    entity_id: int | None,
    payload_json: dict[str, Any] | None,
    prefer_async: bool = False,
) -> None:
    row = await dispatch_create_notification(
        session=session,
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        entity_type=entity_type,
        entity_id=entity_id,
        payload_json=payload_json,
        prefer_async=prefer_async,
    )

    if row.get("enqueued"):
        await publish_to_user(user_id, {"type": "notification_enqueued", "payload": row})
        return

    await publish_to_user(
        user_id,
        {
            "type": "notification_created",
            "notification": row,
        },
    )


async def notify_chat_message(
    session: AsyncSession,
    *,
    to_user_id: int,
    from_user_id: int,
    chat_id: int,
    message_id: int,
    text_preview: str,
) -> None:
    preview = (text_preview or "").strip()
    if len(preview) > 180:
        preview = preview[:177] + "..."

    await _create_and_publish(
        session=session,
        user_id=to_user_id,
        type="chat_message",
        title="Нове повідомлення",
        body=preview or None,
        entity_type="chat",
        entity_id=chat_id,
        payload_json={
            "chat_id": chat_id,
            "message_id": message_id,
            "from_user_id": from_user_id,
        },
        prefer_async=False,
    )


async def notify_application_status_changed(
    session: AsyncSession,
    *,
    worker_user_id: int,
    application_id: int,
    vacancy_id: int,
    vacancy_title: str | None,
    from_status: str,
    to_status: str,
    comment: str | None,
) -> None:
    title = "Application status updated"
    body_parts = [f"{from_status} -> {to_status}"]
    if vacancy_title:
        body_parts.insert(0, vacancy_title)
    if comment:
        body_parts.append(comment)
    body = " | ".join(body_parts)[:500]

    await _create_and_publish(
        session=session,
        user_id=worker_user_id,
        type="application_status",
        title=title,
        body=body,
        entity_type="application",
        entity_id=application_id,
        payload_json={
            "application_id": application_id,
            "vacancy_id": vacancy_id,
            "from_status": from_status,
            "to_status": to_status,
        },
        prefer_async=False,
    )


async def notify_resume_saved(
    session: AsyncSession,
    *,
    worker_user_id: int,
    resume_id: int,
    company_id: int,
    company_name: str | None,
) -> None:
    title = "Ваше резюме збережено"
    body = company_name or None
    await _create_and_publish(
        session=session,
        user_id=worker_user_id,
        type="resume_saved",
        title=title,
        body=body,
        entity_type="resume",
        entity_id=resume_id,
        payload_json={"resume_id": resume_id, "company_id": company_id},
        prefer_async=False,
    )


async def notify_new_application_to_employer(
    session: AsyncSession,
    *,
    employer_user_id: int,
    worker_user_id: int,
    application_id: int,
    vacancy_id: int,
    vacancy_title: str | None,
    candidate_name: str | None,
    resume_id: int | None,
) -> None:
    title = "Новий відгук на вакансію"
    body_parts: list[str] = []
    if vacancy_title:
        body_parts.append(vacancy_title)
    if candidate_name:
        body_parts.append(f"Кандидат: {candidate_name}")
    body = " | ".join(body_parts)[:500] or None

    await _create_and_publish(
        session=session,
        user_id=employer_user_id,
        type="application_created",
        title=title,
        body=body,
        entity_type="application",
        entity_id=application_id,
        payload_json={
            "application_id": application_id,
            "vacancy_id": vacancy_id,
            "resume_id": resume_id,
            "worker_user_id": worker_user_id,
        },
        prefer_async=False,
    )
