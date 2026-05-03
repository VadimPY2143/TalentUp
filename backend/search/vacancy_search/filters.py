from __future__ import annotations

from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Iterable

from pydantic import BaseModel, Field, model_validator
from sqlalchemy import Select, and_, or_

from database import vacancies_table


class WorkFormat(str, Enum):
    REMOTE = "Remote"
    HYBRID = "Hybrid"
    OFFICE = "Office"  # UI label: On-site


class EmploymentKind(str, Enum):
    FULL_TIME = "Full-time"
    PART_TIME = "Part-time"
    CONTRACT = "Contract"
    INTERNSHIP = "Internship"
    TEMPORARY = "Temporary"


class PublishedWithin(str, Enum):
    H24 = "24h"
    D3 = "3d"
    WEEK = "7d"
    MONTH = "30d"


WORK_FORMAT_ALIASES: dict[WorkFormat, tuple[str, ...]] = {
    WorkFormat.REMOTE: ("Remote", "remote"),
    WorkFormat.HYBRID: ("Hybrid", "hybrid"),
    WorkFormat.OFFICE: (
        "Office",
        "office",
        "Onsite",
        "onsite",
        "On-site",
        "on-site",
        "Offline",
        "offline",
    ),
}


class VacancySearchFilters(BaseModel):
    city_id: int | None = Field(default=None, ge=1)
    location: str | None = Field(default=None, max_length=255)
    location_aliases: list[str] | None = None

    company_id: int | None = Field(default=None, ge=1)

    employment_kind: list[EmploymentKind] | None = None
    work_format: list[WorkFormat] | None = None

    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    salary_currency: str | None = Field(default=None, max_length=10)

    experience_years_min: int | None = Field(default=None, ge=0, le=80)
    experience_years_max: int | None = Field(default=None, ge=0, le=80)

    published_within: PublishedWithin | None = None

    exclude_expired: bool = True

    @model_validator(mode="after")
    def _validate_ranges(self) -> "VacancySearchFilters":
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


def _overlap(column, values: Iterable[str]):
    return column.op("&&")(list(values))


def _match_any_array(column_names: Iterable, values: Iterable[str]):
    normalized_values = list(dict.fromkeys(value.strip() for value in values if value.strip()))
    return or_(*(_overlap(column, normalized_values) for column in column_names))


def _published_since(v: PublishedWithin) -> datetime:
    now = datetime.now(timezone.utc)
    if v == PublishedWithin.H24:
        return now - timedelta(hours=24)
    if v == PublishedWithin.D3:
        return now - timedelta(days=3)
    if v == PublishedWithin.WEEK:
        return now - timedelta(days=7)
    return now - timedelta(days=30)


def apply_vacancy_search_filters(stmt: Select, f: VacancySearchFilters) -> Select:
    conditions = []

    if f.city_id is not None:
        location_conditions = [vacancies_table.c.city_id == f.city_id]
        aliases = [alias.strip() for alias in f.location_aliases or [] if alias.strip()]
        if aliases:
            location_conditions.extend(
                vacancies_table.c.location.ilike(f"%{alias}%")
                for alias in aliases
            )
        conditions.append(or_(*location_conditions))
    elif f.location:
        conditions.append(vacancies_table.c.location.ilike(f"%{f.location.strip()}%"))

    if f.company_id is not None:
        conditions.append(vacancies_table.c.company_id == f.company_id)

    if f.employment_kind:
        conditions.append(_overlap(vacancies_table.c.employment_type, [e.value for e in f.employment_kind]))
    if f.work_format:
        work_format_values = [
            alias
            for work_format in f.work_format
            for alias in WORK_FORMAT_ALIASES.get(work_format, (work_format.value,))
        ]
        conditions.append(
            _match_any_array(
                (vacancies_table.c.work_format, vacancies_table.c.employment_type),
                work_format_values,
            )
        )

    if f.salary_currency:
        conditions.append(vacancies_table.c.salary_currency == f.salary_currency)

    if f.salary_min is not None:
        conditions.append(vacancies_table.c.salary_max.isnot(None))
        conditions.append(vacancies_table.c.salary_max >= f.salary_min)
    if f.salary_max is not None:
        conditions.append(vacancies_table.c.salary_min.isnot(None))
        conditions.append(vacancies_table.c.salary_min <= f.salary_max)

    if f.experience_years_min is not None:
        conditions.append(vacancies_table.c.experience_years_min.isnot(None))
        conditions.append(vacancies_table.c.experience_years_min >= f.experience_years_min)
    if f.experience_years_max is not None:
        conditions.append(vacancies_table.c.experience_years_max.isnot(None))
        conditions.append(vacancies_table.c.experience_years_max <= f.experience_years_max)

    if f.published_within:
        conditions.append(vacancies_table.c.created_at >= _published_since(f.published_within))

    if conditions:
        stmt = stmt.where(and_(*conditions))
    return stmt
