from enum import Enum
from pydantic import BaseModel, EmailStr, SecretStr


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
