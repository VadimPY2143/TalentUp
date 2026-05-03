from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class AppHttpSettings:
    cors_origins: list[str]
    cors_methods: list[str]
    cors_headers: list[str]
    oauth_session_secret: str
    oauth_session_same_site: str
    oauth_session_https_only: bool
    oauth_session_cookie_name: str


def _normalize_origin(value: str) -> str | None:
    cleaned = value.strip().rstrip("/")
    if not cleaned:
        return None
    parsed = urlparse(cleaned)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    return cleaned


def _parse_bool(value: str) -> bool | None:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return None


def _resolve_cors_origins() -> list[str]:
    origins: list[str] = []

    raw = os.getenv("CORS_ORIGINS", "")
    if raw:
        for item in raw.split(","):
            normalized = _normalize_origin(item)
            if normalized:
                origins.append(normalized)

    for key in ("FRONTEND_ORIGIN", "FRONTEND_URL"):
        normalized = _normalize_origin(os.getenv(key, ""))
        if normalized:
            origins.append(normalized)

    if not origins:
        origins.append("http://localhost:5173")

    deduplicated: list[str] = []
    seen: set[str] = set()
    for origin in origins:
        if origin not in seen:
            deduplicated.append(origin)
            seen.add(origin)
    return deduplicated


def _resolve_oauth_session_same_site() -> str:
    value = (os.getenv("OAUTH_SESSION_SAME_SITE") or "none").strip().lower()
    if value in {"lax", "strict", "none"}:
        return value
    return "none"


def _resolve_oauth_session_https_only() -> bool:
    explicit = _parse_bool(os.getenv("OAUTH_SESSION_HTTPS_ONLY", ""))
    if explicit is not None:
        return explicit
    server_origin = (os.getenv("SERVER_ORIGIN") or "").strip().lower()
    return server_origin.startswith("https://")


def load_http_settings() -> AppHttpSettings:
    return AppHttpSettings(
        cors_origins=_resolve_cors_origins(),
        cors_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        cors_headers=[
            "Authorization",
            "Content-Type",
            "Accept",
            "Origin",
            "X-Requested-With",
            "ngrok-skip-browser-warning",
        ],
        oauth_session_secret=os.getenv(
            "OAUTH_SESSION_SECRET",
            os.getenv("JWT_SECRET_KEY", "change-me"),
        ),
        oauth_session_same_site=_resolve_oauth_session_same_site(),
        oauth_session_https_only=_resolve_oauth_session_https_only(),
        oauth_session_cookie_name=os.getenv("OAUTH_SESSION_COOKIE_NAME", "oauth_session"),
    )
