from datetime import datetime

from pydantic import BaseModel, Field


class ChatCreateRequest(BaseModel):
    vacancy_id: int = Field(gt=0)
    worker_user_id: int = Field(gt=0)


class ChatResponse(BaseModel):
    id: int
    vacancy_id: int
    employer_user_id: int
    worker_user_id: int
    last_message_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ChatMessageResponse(BaseModel):
    id: int
    chat_id: int
    user_id: int
    message: str
    created_at: datetime


class ChatMessagesListResponse(BaseModel):
    messages: list[ChatMessageResponse]


class MyChatResponse(ChatResponse):
    unread_count: int


class MyChatsListResponse(BaseModel):
    chats: list[MyChatResponse]


class ChatUnreadCounter(BaseModel):
    chat_id: int
    unread_count: int


class ChatUnreadCountersResponse(BaseModel):
    total_unread: int
    counters: list[ChatUnreadCounter]


class WebSocketIncomingMessage(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    to_user_id: int | None = Field(default=None, gt=0)
