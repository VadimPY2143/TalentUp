from enum import Enum
from pydantic import BaseModel, EmailStr, SecretStr

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


class UserProfileResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: UserRole


class UserLogin(BaseModel):
    email: EmailStr
    password: SecretStr


class RefreshRequest(BaseModel):
    refresh_token: str


class UserProfileUpdate(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    password: SecretStr | None = None
