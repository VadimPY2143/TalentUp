from dotenv import load_dotenv
import os
from pathlib import Path

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

import uvicorn

load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI()

# from employer.company.views import router as company_router
# from employer.vacancy.views import router as vacancy_router
# from chat.views import router as chat_router  # Temporarily disabled
# from search.resume_search.views import router as search_router  # Temporarily disabled
# from search.vacancy_search.views import router as vacancy_search_router  # Temporarily disabled
from users.crud import router as user_router
# from users.oauth import router as oauth_router  # Temporarily disabled
from users.views import router as user_profile_router
from worker.applications.views import router as worker_applications_router
from worker.resumes.views import router as worker_resumes_router
from vacancy_search_temp import router as vacancy_search_temp_router


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
app.include_router(user_profile_router)
app.include_router(worker_resumes_router)
app.include_router(worker_applications_router)
# app.include_router(company_router)
# app.include_router(vacancy_router)
# app.include_router(chat_router)  # Temporarily disabled
# app.include_router(search_router)
app.include_router(vacancy_search_temp_router)
# app.include_router(oauth_router)


# 🔹 Запуск
if __name__ == "__main__":
    uvicorn.run("main:app", reload=False)
