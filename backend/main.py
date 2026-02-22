from fastapi import FastAPI, Depends
from users.crud import router as user_router
import uvicorn

app = FastAPI()

app.include_router(user_router)

if __name__ == "__main__":
    uvicorn.run(app)