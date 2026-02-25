from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import insert
from datetime import timedelta
from .auth import ACCESS_TOKEN_EXPIRE_MINUTES, create_access_token, get_password_hash, verify_password
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_session, users_table
from .models import Token, User, UserLogin, UserResponse

router = APIRouter()

@router.post("/user/register", response_model=UserResponse)
async def user_register(
        user: User,
        session: AsyncSession = Depends(get_session)) -> UserResponse:
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


@router.post("/user/login", response_model=Token)
async def user_login(
        user: UserLogin,
        session: AsyncSession = Depends(get_session),
):
    stmt = users_table.select().where(users_table.c.email == user.email)
    result = await session.execute(stmt)
    db_user = result.fetchone()
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    password_hash = db_user._mapping["password"]
    if not verify_password(user.password.get_secret_value(), password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user._mapping["email"], "role": db_user._mapping["role"]},
        expires_delta=access_token_expires,
    )

    return Token(access_token=access_token, token_type="bearer")
