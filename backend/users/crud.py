from datetime import datetime, timedelta
from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from .models import (
    ChangePasswordRequest,
    LanguageOption,
    RefreshRequest,
    Token,
    User,
    UserLogin,
    UserResponse,
)
from database import get_session, languages_table, refresh_tokens_table, user_profiles_table, users_table
from .auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_password_hash,
    get_refresh_token_expiry,
    hash_refresh_token,
    _authenticate_user,
    REFRESH_COOKIE_NAME,
    clear_refresh_cookie,
    set_refresh_cookie,
)
from .repositories import UserSecurityRepository
from .services import UserSecurityService

router = APIRouter(tags=["users"])
security_service = UserSecurityService(repository=UserSecurityRepository())


@router.get("/languages", response_model=list[LanguageOption])
async def list_languages(
    query: str | None = None,
    limit: int = 12,
    session: AsyncSession = Depends(get_session),
) -> list[LanguageOption]:
    normalized_limit = max(1, min(limit, 50))
    stmt = select(languages_table).order_by(
        languages_table.c.popularity_rank.asc(),
        languages_table.c.name.asc(),
    )

    if query and query.strip():
        pattern = f"%{query.strip().lower()}%"
        stmt = stmt.where(func.lower(languages_table.c.name).like(pattern))

    result = await session.execute(stmt.limit(normalized_limit))
    rows = result.mappings().all()
    return [LanguageOption(id=row["id"], name=row["name"]) for row in rows]
def _extract_refresh_candidates(request: Request, payload: RefreshRequest | None) -> list[str]:
    candidates: list[str] = []
    if payload and payload.refresh_token:
        candidates.append(payload.refresh_token.strip())

    cookie_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if cookie_token:
        candidates.append(cookie_token.strip())

    raw_cookie_header = request.headers.get("cookie", "")
    if raw_cookie_header:
        prefix = f"{REFRESH_COOKIE_NAME}="
        for chunk in raw_cookie_header.split(";"):
            part = chunk.strip()
            if part.startswith(prefix):
                token = part[len(prefix):].strip()
                if token:
                    candidates.append(token)

    unique: list[str] = []
    seen: set[str] = set()
    for token in candidates:
        if token and token not in seen:
            unique.append(token)
            seen.add(token)
    return unique

@router.post("/user/register", response_model=UserResponse)
async def user_register(
    user: User,
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    stmt = select(users_table).where(users_table.c.username == user.username)
    result = await session.execute(stmt)
    user_exists = result.fetchone()

    if user_exists:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed_password = get_password_hash(user.password.get_secret_value())
    stmt = insert(users_table).values(
        username=user.username,
        email=user.email,
        password=hashed_password,
        role=user.role.value,
    )
    await session.execute(stmt)
    await session.commit()

    return UserResponse(username=user.username, email=user.email, role=user.role.value)


@router.post("/user/login", response_model=Token)
async def user_login(
    user: UserLogin,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> Token:
    db_user = await _authenticate_user(
        session=session,
        email=str(user.email),
        password=user.password.get_secret_value(),
    )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user["email"], "role": db_user["role"]},
        expires_delta=access_token_expires,
    )

    refresh_token = create_refresh_token()
    refresh_token_hash = hash_refresh_token(refresh_token)
    refresh_expires_at = get_refresh_token_expiry()

    await session.execute(
        insert(refresh_tokens_table).values(
            user_id=db_user["id"],
            token_hash=refresh_token_hash,
            expires_at=refresh_expires_at,
        )
    )
    await session.commit()

    set_refresh_cookie(response, refresh_token)
    return Token(
        access_token=access_token,
        token_type="bearer",
    )


@router.post("/user/change-password", response_model=Token)
async def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> Token:
    token_pair = await security_service.change_password(
        session=session,
        current_user=current_user,
        current_password=payload.current_password.get_secret_value(),
        new_password=payload.new_password.get_secret_value(),
    )
    set_refresh_cookie(response, token_pair.refresh_token)
    return Token(
        access_token=token_pair.access_token,
        token_type=token_pair.token_type,
    )


@router.post("/user/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    response: Response,
    payload: RefreshRequest | None = Body(default=None),
    session: AsyncSession = Depends(get_session),
) -> Token:
    refresh_candidates = _extract_refresh_candidates(request, payload)
    if not refresh_candidates:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    hashes = [hash_refresh_token(token) for token in refresh_candidates]

    stmt = select(refresh_tokens_table).where(
        refresh_tokens_table.c.token_hash.in_(hashes),
        refresh_tokens_table.c.revoked_at.is_(None),
        refresh_tokens_table.c.expires_at > datetime.utcnow(),
    ).order_by(refresh_tokens_table.c.created_at.desc())
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

    set_refresh_cookie(response, new_refresh_token)
    return Token(
        access_token=access_token,
        token_type="bearer",
    )


@router.post("/user/logout", status_code=status.HTTP_204_NO_CONTENT)
async def user_logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> Response:
    refresh_token_value = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_token_value:
        token_hash = hash_refresh_token(refresh_token_value)
        await session.execute(
            update(refresh_tokens_table)
            .where(
                refresh_tokens_table.c.token_hash == token_hash,
                refresh_tokens_table.c.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.utcnow())
        )
        await session.commit()
    clear_refresh_cookie(response)
    return response


@router.get("/users/me", response_model=UserResponse)
async def get_me(
    current_user: dict = Depends(get_current_user),
) -> UserResponse:
    return UserResponse(
        username=current_user["username"],
        email=current_user["email"],
        role=current_user["role"],
    )
