from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field, SecretStr, field_validator


def _split_profile_values(value: str | list[str] | None, *, split_commas: bool) -> list[str] | None:
    if value is None:
        return None

    if isinstance(value, str):
        raw_items = [value]
    else:
        raw_items = value

    normalized: list[str] = []
    seen: set[str] = set()

    for item in raw_items:
        if item is None:
            continue
        if not isinstance(item, str):
            item = str(item)

        chunks = item.splitlines()
        if not chunks:
            chunks = [item]

        for chunk in chunks:
            parts = chunk.split(",") if split_commas else [chunk]
            for part in parts:
                cleaned = " ".join(part.strip().split())
                if not cleaned:
                    continue
                lowered = cleaned.casefold()
                if lowered in seen:
                    continue
                seen.add(lowered)
                normalized.append(cleaned)

    return normalized

class Token(BaseModel):
    access_token: str
    token_type: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class UserRole(str, Enum):
    employer = "employer"
    worker = "worker"


class User(BaseModel):
    username: str
    email: EmailStr
    password: SecretStr
    role: UserRole = UserRole.worker


class UserResponse(BaseModel):
    username: str
    email: EmailStr
    role: UserRole


class UserLogin(BaseModel):
    email: EmailStr
    password: SecretStr


class ChangePasswordRequest(BaseModel):
    current_password: SecretStr
    new_password: SecretStr


class RefreshRequest(BaseModel):
    refresh_token: str


class UserProfileBase(BaseModel):
    city: str | None = Field(default=None, max_length=100)
    education: str | None = Field(default=None, max_length=255)
    bio: str | None = None
    birth_date: date | None = None
    phone: str | None = Field(default=None, max_length=50)
    languages: list[str] | None = None
    links: list[str] | None = None

    @field_validator("languages", mode="before")
    @classmethod
    def normalize_languages(cls, value: str | list[str] | None) -> list[str] | None:
        return _split_profile_values(value, split_commas=True)

    @field_validator("links", mode="before")
    @classmethod
    def normalize_links(cls, value: str | list[str] | None) -> list[str] | None:
        return _split_profile_values(value, split_commas=False)


class UserProfileCreate(UserProfileBase):
    pass


class UserProfileUpdate(UserProfileBase):
    pass


class LanguageOption(BaseModel):
    id: int
    name: str


class UserProfileResponse(UserProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
