from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class Vacancy(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=10)
    responsibilities: Optional[str] = None
    requirements: Optional[str] = None
    is_active: bool = True
    employment_type: Optional[list[str]] = None
    city_id: Optional[int] = Field(default=None, ge=1)
    location: Optional[str] = Field(default=None, max_length=255)
    salary_min: Optional[int] = Field(default=None, ge=0)
    salary_max: Optional[int] = Field(default=None, ge=0)
    salary_currency: Optional[str] = Field(default=None, max_length=10)
    experience_years_min: Optional[int] = Field(default=None, ge=0)
    experience_years_max: Optional[int] = Field(default=None, ge=0)
    work_format: Optional[list[str]] = None


class VacancyAIFillRequest(BaseModel):
    description: str = Field(min_length=10)


class VacancyUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=255)
    description: Optional[str] = Field(default=None, min_length=10)
    responsibilities: Optional[str] = None
    requirements: Optional[str] = None
    is_active: Optional[bool] = None
    employment_type: Optional[list[str]] = None
    city_id: Optional[int] = Field(default=None, ge=1)
    location: Optional[str] = Field(default=None, max_length=255)
    salary_min: Optional[int] = Field(default=None, ge=0)
    salary_max: Optional[int] = Field(default=None, ge=0)
    salary_currency: Optional[str] = Field(default=None, max_length=10)
    experience_years_min: Optional[int] = Field(default=None, ge=0)
    experience_years_max: Optional[int] = Field(default=None, ge=0)
    work_format: Optional[list[str]] = None


class VacancyResponse(Vacancy):
    id: int
    company_id: int
    created_by_user_id: int
    created_at: datetime
    updated_at: datetime
