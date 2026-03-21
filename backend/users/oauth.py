import os
import re
import secrets
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlencode

from authlib.integrations.starlette_client import OAuth
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session, refresh_tokens_table, users_table
from users.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    create_refresh_token,
    get_password_hash,
    get_refresh_token_expiry,
    hash_refresh_token,
)

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

router = APIRouter(tags=["oauth"])
oauth = OAuth()

oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

oauth.register(
    name="linkedin",
    client_id=os.getenv("LINKEDIN_CLIENT_ID"),
    client_secret=os.getenv("LINKEDIN_CLIENT_SECRET"),
    server_metadata_url="https://www.linkedin.com/oauth/.well-known/openid-configuration",
    client_kwargs={"scope": "openid profile email"},
)


def _frontend_origin() -> str:
    return os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").rstrip("/")


def _redirect_to_frontend_callback(access_token: str, refresh_token: str) -> RedirectResponse:
    query = urlencode(
        {
            "access_token": access_token,
            "refresh_token": refresh_token,
        }
    )
    return RedirectResponse(url=f"{_frontend_origin()}/oauth/callback?{query}")


def _redirect_with_error(message: str) -> RedirectResponse:
    query = urlencode({"oauth_error": message})
    return RedirectResponse(url=f"{_frontend_origin()}/login?{query}")


async def _generate_unique_username(session: AsyncSession, seed: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9_.-]", "", seed or "").strip("._-").lower()
    base = (normalized or "user")[:40]
    candidate = base
    counter = 1

    while True:
        stmt = select(users_table.c.id).where(users_table.c.username == candidate)
        exists = (await session.execute(stmt)).scalar_one_or_none()
        if not exists:
            return candidate

        suffix = f"_{counter}"
        candidate = f"{base[: max(1, 40 - len(suffix))]}{suffix}"
        counter += 1


async def _get_or_create_user(
    session: AsyncSession,
    email: str,
    preferred_username: str,
) -> dict:
    stmt = select(users_table).where(users_table.c.email == email)
    existing = (await session.execute(stmt)).mappings().first()
    if existing:
        return dict(existing)

    username = await _generate_unique_username(session, preferred_username)
    random_password = secrets.token_urlsafe(24)
    hashed_password = get_password_hash(random_password)

    create_stmt = (
        insert(users_table)
        .values(
            username=username,
            email=email,
            password=hashed_password,
            role="worker",
        )
        .returning(*users_table.c)
    )
    created = (await session.execute(create_stmt)).mappings().one()
    await session.commit()
    return dict(created)


async def _issue_tokens_for_user(session: AsyncSession, user: dict) -> tuple[str, str]:
    access_token = create_access_token(
        data={"sub": user["email"], "role": user["role"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token()
    refresh_token_hash = hash_refresh_token(refresh_token)
    refresh_expires_at = get_refresh_token_expiry()

    await session.execute(
        insert(refresh_tokens_table).values(
            user_id=user["id"],
            token_hash=refresh_token_hash,
            expires_at=refresh_expires_at,
        )
    )
    await session.commit()
    return access_token, refresh_token


def _get_server_origin(request: Request) -> str:
    configured = os.getenv("SERVER_ORIGIN")
    if configured:
        return configured.rstrip("/")
    return str(request.base_url).rstrip("/")


@router.get("/auth/google/login")
async def login_google(request: Request):
    redirect_uri = f"{_get_server_origin(request)}/auth/google/callback"
    print(f"Google OAuth redirect_uri: {redirect_uri}")
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/auth/google/callback")
async def auth_google_callback(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    print(f"Google OAuth callback reached with query params: {dict(request.query_params)}")
    try:
        token = await oauth.google.authorize_access_token(request)
        userinfo = token.get("userinfo")
        if not userinfo:
            user_resp = await oauth.google.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                token=token,
            )
            userinfo = user_resp.json()
    except Exception as e:
        print(f"Google OAuth error: {e}")
        return _redirect_with_error("Google OAuth failed")

    email = (userinfo or {}).get("email")
    if not email:
        return _redirect_with_error("Google account has no email")

    preferred_username = (userinfo or {}).get("name") or email.split("@", 1)[0]
    user = await _get_or_create_user(session, email=email, preferred_username=preferred_username)
    access_token, refresh_token = await _issue_tokens_for_user(session, user)
    return _redirect_to_frontend_callback(access_token, refresh_token)


@router.get("/auth/linkedin/login")
async def login_linkedin(request: Request):
    redirect_uri = f"{_get_server_origin(request)}/auth/linkedin/callback"
    print(f"LinkedIn OAuth redirect_uri: {redirect_uri}")
    return await oauth.linkedin.authorize_redirect(request, redirect_uri)


@router.get("/auth/linkedin/callback")
async def auth_linkedin_callback(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    print(f"LinkedIn OAuth callback reached with query params: {dict(request.query_params)}")
    if request.query_params.get("error"):
        error_code = request.query_params.get("error", "")
        error_description = request.query_params.get("error_description", "")
        error_message = error_description or error_code or "LinkedIn OAuth denied"
        return _redirect_with_error(f"LinkedIn: {error_message}")

    try:
        token = await oauth.linkedin.authorize_access_token(request)
        user_resp = await oauth.linkedin.get(
            "https://api.linkedin.com/v2/userinfo",
            token=token,
        )
        userinfo = user_resp.json()
    except Exception as e:
        print(f"LinkedIn OAuth error: {e}")
        return _redirect_with_error("LinkedIn OAuth failed")

    email = (userinfo or {}).get("email")
    if not email:
        return _redirect_with_error("LinkedIn account has no email")

    preferred_username = (
        (userinfo or {}).get("name")
        or (userinfo or {}).get("given_name")
        or email.split("@", 1)[0]
    )

    user = await _get_or_create_user(session, email=email, preferred_username=preferred_username)
    access_token, refresh_token = await _issue_tokens_for_user(session, user)
    return _redirect_to_frontend_callback(access_token, refresh_token)
