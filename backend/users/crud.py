from logger import logger as LOGGER
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import insert
from .auth import get_password_hash
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_session, users_table
from .models import User, UserResponse

router = APIRouter()

@router.post("/users/register", response_model=UserResponse)
async def user_register(user: User, session: AsyncSession = Depends(get_session)) -> UserResponse:
    stmt = users_table.select().where(users_table.c.username == user.username)
    result = await session.execute(stmt)
    user_exists = result.fetchone()

    if user_exists:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed_password = get_password_hash(user.password.get_secret_value())
    stmt = insert(users_table).values(username=user.username, email=user.email, password=hashed_password, role=user.role.value)
    await session.execute(stmt)
    await session.commit()

    return UserResponse(
        username=user.username,
        email=user.email,
        role=user.role.value,
    )
