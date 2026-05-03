import os

import pytest
from httpx import ASGITransport, AsyncClient
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware


def _find_middleware(app, cls):
    for mw in getattr(app, "user_middleware", []):
        if mw.cls is cls:
            return mw
    return None


def test_cors_not_wildcard_when_credentials_enabled(app):
    mw = _find_middleware(app, CORSMiddleware)
    assert mw is not None, "CORSMiddleware is not configured"

    allow_origins = mw.kwargs.get("allow_origins", [])
    allow_credentials = mw.kwargs.get("allow_credentials", False)

    # If credentials are allowed, wildcard origin is unsafe and blocked by browsers anyway.
    if allow_credentials:
        assert "*" not in allow_origins, (
            "CORS is configured with allow_credentials=True and allow_origins includes '*'. "
            "Use explicit origins."
        )


def test_cors_origin_is_explicit_for_non_dev(app):
    """
    Basic guardrail: in non-local dev, FRONTEND_ORIGIN should typically be set explicitly.
    """
    if os.getenv("SECURITY_STRICT", "0") != "1":
        pytest.skip("Set SECURITY_STRICT=1 to enforce deployment-config guardrails in tests")

    frontend_origin = os.getenv("FRONTEND_ORIGIN", "")
    # If not set, the app falls back to localhost; that is fine for dev but risky if shipped as-is.
    assert frontend_origin, (
        "FRONTEND_ORIGIN is not set. The backend will default CORS to http://localhost:5173. "
        "Set FRONTEND_ORIGIN in real deployments."
    )


def test_session_secret_is_not_default_change_me(app):
    mw = _find_middleware(app, SessionMiddleware)
    assert mw is not None, "SessionMiddleware is not configured"

    secret_key = mw.kwargs.get("secret_key")
    assert secret_key != "change-me", (
        "Session secret key fell back to the insecure default 'change-me'. "
        "Set OAUTH_SESSION_SECRET (preferred) or JWT_SECRET_KEY."
    )


def test_session_cookie_https_only_in_strict_mode(app):
    """
    For real deployments behind HTTPS you typically want cookies marked Secure.
    Starlette's SessionMiddleware uses `https_only` to enforce that.
    """
    if os.getenv("SECURITY_STRICT", "0") != "1":
        pytest.skip("Set SECURITY_STRICT=1 to enforce cookie hardening checks")

    mw = _find_middleware(app, SessionMiddleware)
    assert mw is not None, "SessionMiddleware is not configured"

    https_only = bool(mw.kwargs.get("https_only", False))
    assert https_only, (
        "SessionMiddleware is not configured with https_only=True. "
        "In production behind HTTPS this should be enabled so cookies are Secure."
    )


@pytest.mark.asyncio
async def test_basic_security_headers_present(app):
    """
    These headers are a common baseline. FastAPI/Starlette won't add them automatically.
    If this fails, consider adding a small middleware to set them.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Pick an always-present endpoint.
        r = await client.get("/docs")

    missing = []
    for h in [
        "x-content-type-options",  # nosniff
        "x-frame-options",  # clickjacking
        "referrer-policy",
    ]:
        if h not in {k.lower(): v for k, v in r.headers.items()}:
            missing.append(h)

    assert not missing, f"Missing recommended security headers: {', '.join(missing)}"
