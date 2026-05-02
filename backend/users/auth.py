from datetime import datetime, timedelta
import hashlib
import secrets
from typing import Optional
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
import bcrypt
from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import users_table, get_session
import os
from dotenv import load_dotenv
from logger import logger as LOGGER

load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not JWT_SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY not set in environment variables")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "refresh_token")
REFRESH_COOKIE_SECURE_RAW = (os.getenv("REFRESH_COOKIE_SECURE") or "auto").strip().lower()
REFRESH_COOKIE_SAMESITE = (os.getenv("REFRESH_COOKIE_SAMESITE") or "lax").strip().lower()
REFRESH_COOKIE_PATH = os.getenv("REFRESH_COOKIE_PATH", "/")

bearer_scheme = HTTPBearer(auto_error=False)

def _normalize_bearer_token(token: str) -> str:
    t = (token or "").strip()
    while t.lower().startswith("bearer "):
        t = t[7:].lstrip()
    return t

async def _authenticate_user(
    session: AsyncSession,
    email: str,
    password: str,
):
    stmt = select(users_table).where(users_table.c.email == email)
    result = await session.execute(stmt)
    db_user = result.mappings().first()

    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return db_user

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_refresh_token_expiry() -> datetime:
    return datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)


def _resolve_refresh_cookie_secure(request: Request | None) -> bool:
    forwarded_proto = ""
    if request is not None:
        forwarded_proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    request_scheme = request.url.scheme.lower() if request is not None else ""
    is_https = forwarded_proto == "https" or request_scheme == "https"

    if REFRESH_COOKIE_SECURE_RAW in {"1", "true", "yes", "on"}:
        # A Secure cookie on plain HTTP is ignored by browsers.
        return is_https

    if REFRESH_COOKIE_SECURE_RAW in {"0", "false", "no", "off"}:
        return False

    return is_https


def _resolve_refresh_cookie_samesite(secure: bool) -> str:
    requested = REFRESH_COOKIE_SAMESITE if REFRESH_COOKIE_SAMESITE in {"lax", "strict", "none"} else "lax"
    if requested == "none" and not secure:
        # Browsers reject SameSite=None when Secure is not set.
        return "lax"
    return requested


def set_refresh_cookie(response: Response, refresh_token: str, request: Request | None = None) -> None:
    secure = _resolve_refresh_cookie_secure(request)
    samesite = _resolve_refresh_cookie_samesite(secure)
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
    )


def clear_refresh_cookie(response: Response, request: Request | None = None) -> None:
    secure = _resolve_refresh_cookie_secure(request)
    samesite = _resolve_refresh_cookie_samesite(secure)
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )


def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except ExpiredSignatureError as e:
        LOGGER.error(f"JWT expired: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        LOGGER.error(f"JWT verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await get_current_user_by_token(credentials.credentials, session)


async def get_current_user_by_token(token: str, session: AsyncSession) -> dict:
    normalized_token = _normalize_bearer_token(token)
    payload = verify_token(normalized_token)
    email = payload.get("sub")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stmt = select(users_table).where(users_table.c.email == email)
    result = await session.execute(stmt)
    user = result.mappings().first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        'id': user["id"],
        'username': user["username"],
        'email': user["email"],
        'password': user["password"],
        'credits': user["credits"],
        'role': user["role"],
    }
