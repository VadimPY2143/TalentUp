from typing import Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    ChatMessageResponse,
    ChatResponse,
    ChatUnreadCounter,
    ChatUnreadCountersResponse,
    MyChatResponse,
)
from .repositories import ChatRepository


class ChatService:
    def __init__(self, repository: ChatRepository) -> None:
        self.repository = repository

    async def create_chat(
        self,
        session: AsyncSession,
        vacancy_id: int,
        employer_user_id: int,
        worker_user_id: int,
    ) -> ChatResponse:
        worker = await self.repository.fetch_worker(
            session=session,
            worker_user_id=worker_user_id,
        )
        if not worker or worker["role"] != "worker":
            raise HTTPException(status_code=404, detail="Worker not found")

        owned_vacancy_id = await self.repository.fetch_owned_vacancy_id(
            session=session,
            vacancy_id=vacancy_id,
            employer_user_id=employer_user_id,
        )
        if owned_vacancy_id is None:
            raise HTTPException(status_code=404, detail="Vacancy not found")

        existing_chat_id = await self.repository.fetch_chat_id_by_vacancy_worker(
            session=session,
            vacancy_id=vacancy_id,
            worker_user_id=worker_user_id,
        )
        if existing_chat_id is not None:
            raise HTTPException(status_code=409, detail="Chat already exists")

        chat = await self.repository.insert_chat(
            session=session,
            vacancy_id=vacancy_id,
            employer_user_id=employer_user_id,
            worker_user_id=worker_user_id,
        )
        await self.repository.insert_chat_members(
            session=session,
            chat_id=chat["id"],
            employer_user_id=employer_user_id,
            worker_user_id=worker_user_id,
        )
        await session.commit()
        return ChatResponse(**chat)

    async def list_my_chats(
        self,
        session: AsyncSession,
        user_id: int,
    ) -> list[MyChatResponse]:
        chats = await self.repository.fetch_user_chats(session=session, user_id=user_id)
        unread_rows = await self.repository.fetch_unread_counts_by_chat(session=session, user_id=user_id)
        unread_by_chat_id = {
            int(row["chat_id"]): int(row["unread_count"])
            for row in unread_rows
        }
        return [
            MyChatResponse(**chat, unread_count=unread_by_chat_id.get(chat["id"], 0))
            for chat in chats
        ]

    async def get_unread_counters(
        self,
        session: AsyncSession,
        user_id: int,
    ) -> ChatUnreadCountersResponse:
        unread_rows = await self.repository.fetch_unread_counts_by_chat(session=session, user_id=user_id)
        counters = [
            ChatUnreadCounter(
                chat_id=int(row["chat_id"]),
                unread_count=int(row["unread_count"]),
            )
            for row in unread_rows
        ]
        total_unread = sum(counter.unread_count for counter in counters)
        return ChatUnreadCountersResponse(total_unread=total_unread, counters=counters)

    async def get_chat_or_404(self, session: AsyncSession, chat_id: int) -> dict[str, Any]:
        chat = await self.repository.fetch_chat(session=session, chat_id=chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        return chat

    async def ensure_chat_member_or_403(
        self,
        session: AsyncSession,
        chat_id: int,
        user_id: int,
    ) -> None:
        member_id = await self.repository.fetch_chat_member_id(
            session=session,
            chat_id=chat_id,
            user_id=user_id,
        )
        if member_id is None:
            raise HTTPException(status_code=403, detail="Access denied")

    async def list_messages(
        self,
        session: AsyncSession,
        chat_id: int,
        limit: int,
        offset: int,
    ) -> list[ChatMessageResponse]:
        rows = await self.repository.fetch_chat_messages(
            session=session,
            chat_id=chat_id,
            limit=limit,
            offset=offset,
        )
        return [ChatMessageResponse(**row) for row in rows]

    async def mark_chat_as_read(
        self,
        session: AsyncSession,
        chat_id: int,
        reader_user_id: int,
    ) -> None:
        await self.repository.mark_chat_messages_as_read(
            session=session,
            chat_id=chat_id,
            reader_user_id=reader_user_id,
        )
        await session.commit()

    async def get_chat_member_ids(self, session: AsyncSession, chat_id: int) -> list[int]:
        return await self.repository.fetch_chat_member_ids(session=session, chat_id=chat_id)

    async def ensure_first_message_rule(
        self,
        session: AsyncSession,
        chat_id: int,
        sender_user_id: int,
        employer_user_id: int,
    ) -> None:
        first_message_id = await self.repository.fetch_first_message_id(
            session=session,
            chat_id=chat_id,
        )
        if first_message_id is None and sender_user_id != employer_user_id:
            raise HTTPException(
                status_code=403,
                detail="First message can be sent only by employer",
            )

    async def create_message(
        self,
        session: AsyncSession,
        chat_id: int,
        sender_user_id: int,
        text: str,
    ) -> dict[str, Any]:
        created_message = await self.repository.insert_message(
            session=session,
            chat_id=chat_id,
            sender_user_id=sender_user_id,
            text=text,
        )
        await self.repository.update_chat_last_message_at(
            session=session,
            chat_id=chat_id,
            last_message_at=created_message["created_at"],
        )
        await session.commit()
        return created_message
