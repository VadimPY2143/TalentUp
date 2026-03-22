from typing import Iterable

from pydantic import BaseModel, Field, model_validator
from sqlalchemy import Select, and_, func

from database import resumes_table


class ResumeSearchFilters(BaseModel):
    location: str | None = Field(default=None, max_length=255)
    employment_type: list[str] | None = None
    salary_from: int | None = Field(default=None, ge=0)
    salary_to: int | None = Field(default=None, ge=0)
    salary_currency: str | None = Field(default=None, max_length=10)
    years_experience: int | None = Field(default=None, ge=0, le=80)

    @model_validator(mode="after")
    def _validate_ranges(self) -> "ResumeSearchFilters":
        if (
            self.salary_from is not None
            and self.salary_to is not None
            and self.salary_from > self.salary_to
        ):
            raise ValueError("salary_from must be <= salary_to")
        return self


def _overlap(column, values: Iterable[str]):
    return column.op("&&")(list(values))


def apply_resume_search_filters(stmt: Select, filters: ResumeSearchFilters) -> Select:
    conditions = [resumes_table.c.is_active.is_(True)]

    if filters.location:
        conditions.append(resumes_table.c.location.ilike(f"%{filters.location.strip()}%"))

    if filters.employment_type:
        values = [value.strip() for value in filters.employment_type if value.strip()]
        if values:
            conditions.append(_overlap(resumes_table.c.employment_type, values))

    if filters.salary_currency:
        conditions.append(resumes_table.c.salary_currency == filters.salary_currency)

    min_salary = func.coalesce(resumes_table.c.salary_min, resumes_table.c.salary_max)
    max_salary = func.coalesce(resumes_table.c.salary_max, resumes_table.c.salary_min)
    if filters.salary_from is not None:
        conditions.append(max_salary.isnot(None))
        conditions.append(max_salary >= filters.salary_from)
    if filters.salary_to is not None:
        conditions.append(min_salary.isnot(None))
        conditions.append(min_salary <= filters.salary_to)

    if filters.years_experience is not None:
        conditions.append(resumes_table.c.years_experience.isnot(None))
        conditions.append(resumes_table.c.years_experience >= filters.years_experience)

    return stmt.where(and_(*conditions))
