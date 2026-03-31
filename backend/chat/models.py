from datetime import datetime

from pydantic import BaseModel, Field


class ChatCreateRequest(BaseModel):
    vacancy_id: int = Field(gt=0)
    resume_id: int = Field(gt=0)


class ChatResponse(BaseModel):
    id: int
    vacancy_id: int
    resume_id: int | None
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
    employer_name: str | None = None
    worker_name: str | None = None
    unread_count: int


class MyChatsListResponse(BaseModel):
    chats: list[MyChatResponse]


class ChatUnreadCounter(BaseModel):
    chat_id: int
    unread_count: int


class ChatUnreadCountersResponse(BaseModel):
    total_unread: int
    counters: list[ChatUnreadCounter]


class ChatResumeResponse(BaseModel):
    id: int
    user_id: int
    title: str
    summary: str | None
    desired_role: str | None
    employment_type: list[str] | None
    location: str | None
    salary_min: int | None
    salary_max: int | None
    salary_currency: str | None
    years_experience: int | None
    is_active: bool
    pdf_file_path: str | None
    pdf_original_name: str | None
    pdf_size: int | None
    pdf_uploaded_at: datetime | None
    created_at: datetime
    updated_at: datetime


class WebSocketIncomingMessage(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    to_user_id: int | None = Field(default=None, gt=0)
