from datetime import datetime

from pydantic import BaseModel, Field


class WorkerProfileLanguage(BaseModel):
    id: int
    language_id: int
    language_name: str
    proficiency_level: str


class WorkerProfileLink(BaseModel):
    id: int
    title: str
    url: str


class WorkerActiveResume(BaseModel):
    id: int
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
    updated_at: datetime


class EmployerWorkerProfileResponse(BaseModel):
    user_id: int
    username: str
    city: str | None = None
    education: str | None = None
    bio: str | None = None
    phone: str | None = None
    languages: list[str] | None = None
    links: list[str] | None = None
    user_languages: list[WorkerProfileLanguage] = Field(default_factory=list)
    user_links: list[WorkerProfileLink] = Field(default_factory=list)
    active_resumes: list[WorkerActiveResume] = Field(default_factory=list)
