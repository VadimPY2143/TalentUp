from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator

from search.vacancy_search.filters import EmploymentKind, WorkFormat

INT32_MAX = 2_147_483_647


class VacancySubscriptionFilters(BaseModel):
    city_id: int | None = Field(default=None, ge=1)
    location: str | None = Field(default=None, max_length=255)
    company_id: int | None = Field(default=None, ge=1)
    employment_kind: list[EmploymentKind] | None = None
    work_format: list[WorkFormat] | None = None
    salary_min: int | None = Field(default=None, ge=0, le=INT32_MAX)
    salary_max: int | None = Field(default=None, ge=0, le=INT32_MAX)
    salary_currency: str | None = Field(default=None, max_length=10)
    experience_years_min: int | None = Field(default=None, ge=0, le=80)
    experience_years_max: int | None = Field(default=None, ge=0, le=80)
    exclude_expired: bool = True

    @model_validator(mode="after")
    def validate_ranges(self) -> "VacancySubscriptionFilters":
        if (
            self.salary_min is not None
            and self.salary_max is not None
            and self.salary_min > self.salary_max
        ):
            raise ValueError("salary_min must be <= salary_max")
        if (
            self.experience_years_min is not None
            and self.experience_years_max is not None
            and self.experience_years_min > self.experience_years_max
        ):
            raise ValueError("experience_years_min must be <= experience_years_max")
        return self


class VacancySubscriptionCreateIn(BaseModel):
    search_text: str = Field(min_length=2, max_length=255)
    filters: VacancySubscriptionFilters = Field(default_factory=VacancySubscriptionFilters)
    next_run_at: datetime | None = None
    is_active: bool = True


class VacancySubscriptionUpdateIn(BaseModel):
    search_text: str | None = Field(default=None, min_length=2, max_length=255)
    filters: VacancySubscriptionFilters | None = None
    next_run_at: datetime | None = None
    is_active: bool | None = None


class VacancySubscriptionSetActiveIn(BaseModel):
    is_active: bool


class VacancySubscriptionOut(BaseModel):
    id: int
    user_id: int
    email: EmailStr
    search_text: str
    filters: VacancySubscriptionFilters
    is_active: bool
    next_run_at: datetime
    last_processed_at: datetime | None = None
    last_sent_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
