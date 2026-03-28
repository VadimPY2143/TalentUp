from typing import Any

from sqlalchemy import and_, func, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import (
    chat_table,
    companies_table,
    messages_table,
    resumes_table,
    users_table,
    vacancies_table,
)


class ChatRepository:
    async def fetch_user_chats(
        self,
        session: AsyncSession,
        user_id: int,
    ) -> list[dict[str, Any]]:
        stmt = (
            select(chat_table)
            .where(
                or_(
                    chat_table.c.employer_user_id == user_id,
                    chat_table.c.worker_user_id == user_id,
                )
            )
            .order_by(chat_table.c.last_message_at.desc().nullslast(), chat_table.c.created_at.desc())
        )
        result = await session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    async def fetch_unread_counts_by_chat(
        self,
        session: AsyncSession,
        user_id: int,
    ) -> list[dict[str, Any]]:
        stmt = (
            select(
                messages_table.c.chat_id,
                func.count(messages_table.c.id).label("unread_count"),
            )
            .select_from(
                messages_table.join(chat_table, messages_table.c.chat_id == chat_table.c.id)
            )
            .where(
                and_(
                    or_(
                        chat_table.c.employer_user_id == user_id,
                        chat_table.c.worker_user_id == user_id,
                    ),
                    messages_table.c.user_id != user_id,
                    messages_table.c.is_read.is_(False),
                )
            )
            .group_by(messages_table.c.chat_id)
        )
        result = await session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    async def fetch_worker(
        self,
        session: AsyncSession,
        worker_user_id: int,
    ) -> dict[str, Any] | None:
        stmt = select(users_table.c.id, users_table.c.role).where(users_table.c.id == worker_user_id)
        result = await session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def fetch_resume_owner(
        self,
        session: AsyncSession,
        resume_id: int,
    ) -> dict[str, Any] | None:
        stmt = select(
            resumes_table.c.id,
            resumes_table.c.user_id,
        ).where(resumes_table.c.id == resume_id)
        result = await session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def fetch_owned_vacancy_id(
        self,
        session: AsyncSession,
        vacancy_id: int,
        employer_user_id: int,
    ) -> int | None:
        stmt = (
            select(vacancies_table.c.id)
            .select_from(
                vacancies_table.join(
                    companies_table,
                    vacancies_table.c.company_id == companies_table.c.id,
                )
            )
            .where(
                vacancies_table.c.id == vacancy_id,
                companies_table.c.user_id == employer_user_id,
            )
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def fetch_chat_id_by_vacancy_resume(
        self,
        session: AsyncSession,
        vacancy_id: int,
        resume_id: int,
    ) -> int | None:
        stmt = select(chat_table.c.id).where(
            chat_table.c.vacancy_id == vacancy_id,
            chat_table.c.resume_id == resume_id,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def insert_chat(
        self,
        session: AsyncSession,
        vacancy_id: int,
        resume_id: int,
        employer_user_id: int,
        worker_user_id: int,
    ) -> dict[str, Any]:
        stmt = (
            insert(chat_table)
            .values(
                vacancy_id=vacancy_id,
                resume_id=resume_id,
                employer_user_id=employer_user_id,
                worker_user_id=worker_user_id,
            )
            .returning(*chat_table.c)
        )
        result = await session.execute(stmt)
        return dict(result.mappings().one())

    async def fetch_chat(self, session: AsyncSession, chat_id: int) -> dict[str, Any] | None:
        stmt = select(chat_table).where(chat_table.c.id == chat_id)
        result = await session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def is_chat_member(
        self,
        session: AsyncSession,
        chat_id: int,
        user_id: int,
    ) -> bool:
        stmt = select(chat_table.c.id).where(
            chat_table.c.id == chat_id,
            or_(
                chat_table.c.employer_user_id == user_id,
                chat_table.c.worker_user_id == user_id,
            ),
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def fetch_chat_messages(
        self,
        session: AsyncSession,
        chat_id: int,
        limit: int,
        offset: int,
    ) -> list[dict[str, Any]]:
        stmt = (
            select(messages_table)
            .where(messages_table.c.chat_id == chat_id)
            .order_by(messages_table.c.created_at.desc(), messages_table.c.id.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    async def fetch_chat_member_ids(self, session: AsyncSession, chat_id: int) -> list[int]:
        stmt = select(
            chat_table.c.employer_user_id,
            chat_table.c.worker_user_id,
        ).where(chat_table.c.id == chat_id)
        result = await session.execute(stmt)
        row = result.first()
        if row is None:
            return []
        if row.employer_user_id == row.worker_user_id:
            return [row.employer_user_id]
        return [row.employer_user_id, row.worker_user_id]

    async def fetch_latest_worker_resume(
        self,
        session: AsyncSession,
        worker_user_id: int,
    ) -> dict[str, Any] | None:
        with_pdf_stmt = (
            select(resumes_table)
            .where(
                resumes_table.c.user_id == worker_user_id,
                resumes_table.c.pdf_file_path.is_not(None),
            )
            .order_by(
                resumes_table.c.updated_at.desc(),
                resumes_table.c.id.desc(),
            )
            .limit(1)
        )
        result = await session.execute(with_pdf_stmt)
        row = result.mappings().first()
        if row:
            return dict(row)

        stmt = (
            select(resumes_table)
            .where(resumes_table.c.user_id == worker_user_id)
            .order_by(
                resumes_table.c.updated_at.desc(),
                resumes_table.c.id.desc(),
            )
            .limit(1)
        )
        result = await session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def fetch_resume_by_id(
        self,
        session: AsyncSession,
        resume_id: int,
    ) -> dict[str, Any] | None:
        stmt = select(resumes_table).where(resumes_table.c.id == resume_id)
        result = await session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def fetch_first_message_id(self, session: AsyncSession, chat_id: int) -> int | None:
        stmt = (
            select(messages_table.c.id)
            .where(messages_table.c.chat_id == chat_id)
            .order_by(messages_table.c.created_at.asc(), messages_table.c.id.asc())
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def insert_message(
        self,
        session: AsyncSession,
        chat_id: int,
        sender_user_id: int,
        text: str,
    ) -> dict[str, Any]:
        stmt = (
            insert(messages_table)
            .values(
                chat_id=chat_id,
                user_id=sender_user_id,
                message=text,
            )
            .returning(*messages_table.c)
        )
        result = await session.execute(stmt)
        return dict(result.mappings().one())

    async def update_chat_last_message_at(
        self,
        session: AsyncSession,
        chat_id: int,
        last_message_at: Any,
    ) -> None:
        await session.execute(
            update(chat_table)
            .where(chat_table.c.id == chat_id)
            .values(last_message_at=last_message_at)
        )

    async def mark_chat_messages_as_read(
        self,
        session: AsyncSession,
        chat_id: int,
        reader_user_id: int,
    ) -> None:
        await session.execute(
            update(messages_table)
            .where(
                messages_table.c.chat_id == chat_id,
                messages_table.c.user_id != reader_user_id,
                messages_table.c.is_read.is_(False),
            )
            .values(is_read=True)
        )
