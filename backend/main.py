from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware

from users.crud import router as user_router
from worker.crud import router as worker_router
from employer.company.crud import router as company_router
from employer.vacancy.crud import router as vacancy_router
from search.resume_search.views import router as search_router
from users.oauth import router as google_router

import uvicorn
import os
from pathlib import Path


# 🔹 Завантаження .env
load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI()


# 🔥 SESSION (ОБОВ’ЯЗКОВО ДЛЯ OAUTH)
app.add_middleware(
    SessionMiddleware,
    secret_key="super-secret-key-change-this-123456789"
)


# 🔥 CORS (ВАЖЛИВО: allow_credentials=True)
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
app.include_router(google_router)


# 🔹 Запуск
if __name__ == "__main__":
    uvicorn.run("main:app", reload=True)
