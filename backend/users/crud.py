from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import insert, select, update
from datetime import datetime, timedelta
from .auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    create_refresh_token,
    get_password_hash,
    get_refresh_token_expiry,
    hash_refresh_token,
    verify_password,
)
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_session, refresh_tokens_table, users_table
from .models import RefreshRequest, TokenPair, User, UserLogin, UserResponse

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


@router.post("/user/login", response_model=TokenPair)
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

    refresh_token = create_refresh_token()
    refresh_token_hash = hash_refresh_token(refresh_token)
    refresh_expires_at = get_refresh_token_expiry()

    await session.execute(
        insert(refresh_tokens_table).values(
            user_id=db_user._mapping["id"],
            token_hash=refresh_token_hash,
            expires_at=refresh_expires_at,
        )
    )
    await session.commit()

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/user/refresh", response_model=TokenPair)
async def refresh_token(
        payload: RefreshRequest,
        session: AsyncSession = Depends(get_session),
):
    token_hash = hash_refresh_token(payload.refresh_token)

    stmt = select(refresh_tokens_table).where(
        refresh_tokens_table.c.token_hash == token_hash,
        refresh_tokens_table.c.revoked_at.is_(None),
        refresh_tokens_table.c.expires_at > datetime.utcnow(),
    )
    result = await session.execute(stmt)
    token_row = result.mappings().first()

    if not token_row:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_stmt = select(users_table).where(users_table.c.id == token_row["user_id"])
    user_result = await session.execute(user_stmt)
    user = user_result.mappings().first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    access_token = create_access_token(
        data={"sub": user["email"], "role": user["role"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    new_refresh_token = create_refresh_token()
    new_refresh_hash = hash_refresh_token(new_refresh_token)
    new_refresh_expires = get_refresh_token_expiry()

    await session.execute(
        update(refresh_tokens_table)
        .where(refresh_tokens_table.c.id == token_row["id"])
        .values(revoked_at=datetime.utcnow())
    )
    await session.execute(
        insert(refresh_tokens_table).values(
            user_id=user["id"],
            token_hash=new_refresh_hash,
            expires_at=new_refresh_expires,
        )
    )
    await session.commit()

    return TokenPair(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
    )
