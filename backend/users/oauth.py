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
    set_refresh_cookie,
    get_password_hash,
    get_refresh_token_expiry,
    hash_refresh_token,
)

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

router = APIRouter(tags=["oauth"])
oauth = OAuth()
GOOGLE_OAUTH_ENABLED = bool(os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET"))
LINKEDIN_OAUTH_ENABLED = bool(
    os.getenv("LINKEDIN_CLIENT_ID") and os.getenv("LINKEDIN_CLIENT_SECRET")
)
OAUTH_ALLOW_STATELESS_FALLBACK = (
    os.getenv("OAUTH_ALLOW_STATELESS_FALLBACK", "false").strip().lower() in {"1", "true", "yes", "on"}
)

if GOOGLE_OAUTH_ENABLED:
    oauth.register(
        name="google",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


def _redirect_frontend(path: str, **params: str) -> RedirectResponse:
    frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").rstrip("/")
    query = urlencode(params)
    url = f"{frontend_origin}{path}"
    return RedirectResponse(url=f"{url}?{query}" if query else url, status_code=302)


async def _get_or_create_user(
    session: AsyncSession,
    email: str,
    preferred_username: str,
) -> dict:
    stmt = select(users_table).where(users_table.c.email == email)
    existing = (await session.execute(stmt)).mappings().first()
    if existing:
        return dict(existing)

    normalized = re.sub(r"[^a-zA-Z0-9_.-]", "", preferred_username or "").strip("._-").lower()
    base_username = (normalized or "user")[:40]
    username = base_username
    counter = 1

    while True:
        username_stmt = select(users_table.c.id).where(users_table.c.username == username)
        username_exists = (await session.execute(username_stmt)).scalar_one_or_none()
        if not username_exists:
            break

        suffix = f"_{counter}"
        username = f"{base_username[: max(1, 40 - len(suffix))]}{suffix}"
        counter += 1

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


async def _issue_refresh_token_for_user(session: AsyncSession, user: dict) -> str:
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
    return refresh_token


def _get_server_origin(request: Request) -> str:
    configured = os.getenv("SERVER_ORIGIN")
    if configured:
        return configured.rstrip("/")
    forwarded_proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip()
    forwarded_host = (request.headers.get("x-forwarded-host") or "").split(",")[0].strip()
    if forwarded_proto and forwarded_host:
        return f"{forwarded_proto}://{forwarded_host}".rstrip("/")
    return str(request.base_url).rstrip("/")


@router.get("/auth/google/login")
async def login_google(request: Request):
    if not GOOGLE_OAUTH_ENABLED:
        return _redirect_frontend(
            "/login",
            oauth_error="Google OAuth is unavailable",
            api_origin=_get_server_origin(request),
        )
    redirect_uri = f"{_get_server_origin(request)}/auth/google/callback"
    print(f"Google OAuth redirect_uri: {redirect_uri}")
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/auth/google/callback")
async def auth_google_callback(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    if not GOOGLE_OAUTH_ENABLED:
        return _redirect_frontend(
            "/login",
            oauth_error="Google OAuth is unavailable",
            api_origin=_get_server_origin(request),
        )
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
        error_text = str(e)
        if OAUTH_ALLOW_STATELESS_FALLBACK and "mismatching_state" in error_text.lower():
            code = request.query_params.get("code")
            if code:
                try:
                    redirect_uri = f"{_get_server_origin(request)}/auth/google/callback"
                    token = await oauth.google.fetch_access_token(
                        grant_type="authorization_code",
                        code=code,
                        redirect_uri=redirect_uri,
                    )
                    user_resp = await oauth.google.get(
                        "https://openidconnect.googleapis.com/v1/userinfo",
                        token=token,
                    )
                    userinfo = user_resp.json()
                except Exception as fallback_exc:
                    print(f"Google OAuth fallback error: {fallback_exc}")
                    return _redirect_frontend(
                        "/login",
                        oauth_error="Google OAuth failed",
                        api_origin=_get_server_origin(request),
                    )
            else:
                print(f"Google OAuth error (no code for fallback): {e}")
                return _redirect_frontend(
                    "/login",
                    oauth_error="Google OAuth failed",
                    api_origin=_get_server_origin(request),
                )
        else:
            print(f"Google OAuth error: {e}")
            return _redirect_frontend(
                "/login",
                oauth_error="Google OAuth failed",
                api_origin=_get_server_origin(request),
            )

    email = (userinfo or {}).get("email")
    if not email:
        return _redirect_frontend(
            "/login",
            oauth_error="Google account has no email",
            api_origin=_get_server_origin(request),
        )

    preferred_username = (userinfo or {}).get("name") or email.split("@", 1)[0]
    user = await _get_or_create_user(session, email=email, preferred_username=preferred_username)
    access_token = create_access_token(
        data={"sub": user["email"], "role": user["role"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = await _issue_refresh_token_for_user(session, user)
    response = _redirect_frontend(
        "/oauth/callback",
        access_token=access_token,
        api_origin=_get_server_origin(request),
    )
    set_refresh_cookie(response, refresh_token)
    return response
