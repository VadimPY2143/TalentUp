from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello World"}

@app.get("/vacancy_search")
def search_vacancies():
    return {"vacancies": [{"id": 1, "title": "Test"}]}

@app.get("/vacancy_search/recommendations")
def recommendations():
    return {"vacancies": [{"id": 2, "title": "Recommended"}]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
