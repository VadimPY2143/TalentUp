from datetime import datetime

from pydantic import BaseModel, Field

from employer.vacancy.models import VacancyResponse
from worker.applications.models import ApplicationStatus


class SavedVacancyCreateIn(BaseModel):
    vacancy_id: int = Field(ge=1)
    note: str | None = Field(default=None, max_length=1000)


class SavedVacancyUpdateIn(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


class SavedVacancyOut(BaseModel):
    id: int
    user_id: int
    vacancy_id: int
    note: str | None = None
    created_at: datetime
    updated_at: datetime
    is_applied: bool
    application_id: int | None = None
    application_status: ApplicationStatus | None = None
    vacancy: VacancyResponse

