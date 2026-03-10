from fastapi import FastAPI
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from users.crud import router as user_router
from worker.crud import router as worker_router
import uvicorn
import os
from pathlib import Path

# Load backend/.env regardless of current working directory.
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

if __name__ == "__main__":
    uvicorn.run(app)
