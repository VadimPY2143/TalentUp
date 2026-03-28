from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class ApplicationStatus(str, Enum):
    applied = "applied"
    viewed = "viewed"
    rejected = "rejected"
    accepted = "accepted"


class VacancyBrief(BaseModel):
    id: int
    title: str
    company_id: int


class ApplicationHistoryOut(BaseModel):
    id: int
    status: ApplicationStatus
    comment: str | None = None
    changed_at: datetime


class JobApplicationOut(BaseModel):
    id: int
    user_id: int
    vacancy_id: int
    resume_id: int | None = None
    resume_title: str | None = None
    cover_letter: str | None = None
    status: ApplicationStatus
    created_at: datetime
    updated_at: datetime
    vacancy: VacancyBrief | None = None
    history: list[ApplicationHistoryOut] = Field(default_factory=list)


class JobApplicationCreateIn(BaseModel):
    vacancy_id: int = Field(ge=1)
    resume_id: int = Field(ge=1)
    cover_letter: str | None = None


class JobApplicationStatusUpdateIn(BaseModel):
    status: ApplicationStatus
    comment: str | None = None


class ApplicationResumeOut(BaseModel):
    id: int
    user_id: int
    title: str
    summary: str | None = None
    desired_role: str | None = None
    employment_type: list[str] | None = None
    location: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str | None = None
    years_experience: int | None = None
    is_active: bool
    pdf_file_path: str | None = None
    pdf_original_name: str | None = None
    pdf_size: int | None = None
    pdf_uploaded_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
