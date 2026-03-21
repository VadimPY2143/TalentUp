import os
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from httpx import AsyncClient

router = APIRouter()

oauth = OAuth()

# GOOGLE
oauth.register(
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

#LINKEDIN
oauth.register(
    name='linkedin',
    client_id=os.getenv("LINKEDIN_CLIENT_ID"),
    client_secret=os.getenv("LINKEDIN_CLIENT_SECRET"),
    authorize_url='https://www.linkedin.com/oauth/v2/authorization',
    access_token_url='https://www.linkedin.com/oauth/v2/accessToken',
    client_kwargs={
        'scope': 'openid profile email'
    }
)

# GOOGLE
@router.get("/auth/google/login")
async def login_google(request: Request):
    redirect_uri = "http://localhost:8000/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/auth/google/callback")
async def auth_google_callback(request: Request):
    token = await oauth.google.authorize_access_token(request)
    user = token.get("userinfo")

    print("GOOGLE USER:", user)

    return RedirectResponse(
        url="http://localhost:5173/dashboard?token=123"
    )


# LINKEDIN
@router.get("/auth/linkedin/login")
async def login_linkedin(request: Request):
    redirect_uri = "http://localhost:8000/auth/linkedin/callback"
    return await oauth.linkedin.authorize_redirect(request, redirect_uri)


@router.get("/auth/linkedin/callback")
async def auth_linkedin_callback(request: Request):

    error = request.query_params.get("error")
    if error:
        return {"error": request.query_params}

    code = request.query_params.get("code")

    if not code:
        return {"error": "No code provided"}


    async with AsyncClient() as client:
        token_resp = await client.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": "http://localhost:8000/auth/linkedin/callback",
                "client_id": os.getenv("LINKEDIN_CLIENT_ID"),
                "client_secret": os.getenv("LINKEDIN_CLIENT_SECRET"),
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded"
            }
        )

    token = token_resp.json()

    if "access_token" not in token:
        return {"error": token}

    access_token = token["access_token"]


    async with AsyncClient() as client:
        user_resp = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={
                "Authorization": f"Bearer {access_token}"
            }
        )

    user = user_resp.json()

    userinfo = {
        "first_name": user.get("given_name"),
        "last_name": user.get("family_name"),
        "email": user.get("email"),
        "picture": user.get("picture")
    }

    print("LINKEDIN USER:", userinfo)

    return RedirectResponse(
        url="http://localhost:5173/dashboard?token=123"
    )