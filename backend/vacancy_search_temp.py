from fastapi import APIRouter

router = APIRouter(tags=["vacancy_search_temp"])

@router.get("/vacancy_search")
async def search_vacancies():
    """Simple vacancy search endpoint"""
    return {
        "vacancies": [
            {
                "id": 1,
                "title": "Test Vacancy",
                "location": "Kyiv",
                "description": "Test description",
                "company_id": 1,
                "salary_min": 1000,
                "salary_max": 2000,
                "salary_currency": "USD",
                "experience_years_min": 1,
                "experience_years_max": 3,
                "employment_type": ["full_time"],
                "work_format": ["remote"],
                "created_at": "2024-01-01T00:00:00Z",
                "expires_at": "2024-12-31T23:59:59Z",
                "is_active": True,
            }
        ]
    }

@router.get("/vacancy_search/recommendations")
async def get_recommendations():
    """Simple recommendations endpoint"""
    return {
        "vacancies": [
            {
                "id": 1,
                "title": "Recommended Vacancy",
                "location": "Lviv",
                "description": "Recommended description",
                "company_id": 1,
                "salary_min": 1500,
                "salary_max": 2500,
                "salary_currency": "USD",
                "experience_years_min": 2,
                "experience_years_max": 4,
                "employment_type": ["full_time"],
                "work_format": ["hybrid"],
                "created_at": "2024-01-01T00:00:00Z",
                "expires_at": "2024-12-31T23:59:59Z",
                "is_active": True,
            }
        ]
    }
