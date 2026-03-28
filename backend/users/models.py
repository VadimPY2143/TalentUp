from datetime import date, datetime
from enum import Enum
from pydantic import BaseModel, EmailStr, Field, SecretStr

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


class UserProfileCreate(UserProfileBase):
    pass


class UserProfileUpdate(BaseModel):
    city: str | None = Field(default=None, max_length=100)
    education: str | None = Field(default=None, max_length=255)
    bio: str | None = None
    birth_date: date | None = None
    phone: str | None = Field(default=None, max_length=50)
    languages: list[str] | None = None
    links: list[str] | None = None


class UserProfileResponse(UserProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
