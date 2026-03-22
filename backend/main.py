from dotenv import load_dotenv
import os
from pathlib import Path

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

import uvicorn

load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI()

from employer.company.crud import router as company_router
from employer.vacancy.crud import router as vacancy_router
from search.resume_search.views import router as search_router
from users.crud import router as user_router
from users.oauth import router as oauth_router
from worker.crud import router as worker_router


app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("OAUTH_SESSION_SECRET", os.getenv("JWT_SECRET_KEY", "change-me")),
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 🔹 Роути
app.include_router(user_router)
app.include_router(worker_router)
app.include_router(company_router)
app.include_router(vacancy_router)
app.include_router(search_router)
app.include_router(oauth_router)


# 🔹 Запуск
if __name__ == "__main__":
    uvicorn.run("main:app", reload=True)
