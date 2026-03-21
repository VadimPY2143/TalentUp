from fastapi import FastAPI
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from users.crud import router as user_router
from worker.crud import router as worker_router
from employer.company.crud import router as company_router
from employer.vacancy.crud import router as vacancy_router
from search.resume_search.views import router as search_router
from search.vacancy_search.views import router as vacancy_search_router
import uvicorn
import os
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(worker_router)
app.include_router(company_router)
app.include_router(vacancy_router)
app.include_router(search_router)
app.include_router(vacancy_search_router)

if __name__ == "__main__":
    uvicorn.run(app)
from database import engine, metadata

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(metadata.create_all)

@app.on_event("startup")
async def startup():
    await create_tables()