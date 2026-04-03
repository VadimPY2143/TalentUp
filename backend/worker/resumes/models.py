from pydantic import BaseModel, Field, model_validator
from enum import Enum


class EmploymentType(str, Enum):
    REMOTE = "Remote"
    OFFICE = "Office"
    HYBRID = "Hybrid"


class CurrencyType(str, Enum):
    USD = "USD"
    EUR = "EUR"
    UAH = "UAH"


class Resume(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    summary: str | None = None
    desired_role: str | None = None
    employment_type: list[EmploymentType] = Field(min_length=1)
    city_id: int | None = Field(default=None, ge=1)
    location: str | None = None
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    salary_currency: CurrencyType = CurrencyType.UAH
    years_experience: int | None = Field(default=None, ge=0, le=80)
    is_active: bool = True

    @model_validator(mode="after")
    def validate_salary_range(self) -> "Resume":
        if (
            self.salary_min is not None
            and self.salary_max is not None
            and self.salary_min > self.salary_max
        ):
            raise ValueError("salary_min must be less than or equal to salary_max")
        return self


class ResumeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    summary: str | None = None
    desired_role: str | None = None
    employment_type: list[EmploymentType] | None = None
    city_id: int | None = Field(default=None, ge=1)
    location: str | None = None
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    salary_currency: CurrencyType | None = None
    years_experience: int | None = Field(default=None, ge=0, le=80)
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_salary_range(self) -> "ResumeUpdate":
        if (
            self.salary_min is not None
            and self.salary_max is not None
            and self.salary_min > self.salary_max
        ):
            raise ValueError("salary_min must be less than or equal to salary_max")
        return self
