from __future__ import annotations

from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Iterable

from pydantic import BaseModel, Field, model_validator
from sqlalchemy import Select, and_, func, or_

from database import resumes_table


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


class SalaryPeriod(str, Enum):
    HOUR = "hour"
    MONTH = "month"
    YEAR = "year"


class ExperienceBucket(str, Enum):
    NO_EXPERIENCE = "0"
    ONE_THREE = "1-3"
    THREE_FIVE = "3-5"
    FIVE_PLUS = "5+"


class EducationLevel(str, Enum):
    NONE = "none"
    BACHELOR = "bachelor"
    MASTER = "master"
    PHD = "phd"


class EnglishLevel(str, Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class PublishedWithin(str, Enum):
    H24 = "24h"
    D3 = "3d"
    WEEK = "7d"
    MONTH = "30d"


class WorkSchedule(str, Enum):
    FLEX = "Flexible"
    FIXED = "Fixed"
    NIGHT = "Night"


class PositionLevel(str, Enum):
    JUNIOR = "Junior"
    MIDDLE = "Middle"
    SENIOR = "Senior"
    LEAD = "Lead"


class CompanyType(str, Enum):
    STARTUP = "Startup"
    CORPORATION = "Corporation"
    OUTSOURCE = "Outsource"
    PRODUCT = "Product"


class CompanySize(str, Enum):
    S_1_10 = "1-10"
    S_10_50 = "10-50"
    S_50_200 = "50-200"
    S_200_PLUS = "200+"


class Benefit(str, Enum):
    MEDICAL = "Medical insurance"
    PAID_LEAVE = "Paid leave"
    LEARNING = "Courses/learning"
    GYM = "Gym"


class ContractType(str, Enum):
    B2B = "B2B"
    EMPLOYMENT = "Employment"
    CONTRACT = "Contract"


class HireSpeed(str, Enum):
    URGENT = "Urgent"
    STANDARD = "Standard"


class ResumeSearchFilters(BaseModel):
    # 1) Location
    city: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    radius_km: int | None = Field(default=None, ge=1, le=500)
    center_lat: float | None = Field(default=None, ge=-90, le=90)
    center_lng: float | None = Field(default=None, ge=-180, le=180)
    work_format: list[WorkFormat] | None = None

    # 2) Employment kind
    employment_kind: list[EmploymentKind] | None = None

    # 3) Salary
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    salary_currency: str | None = Field(default=None, max_length=10)
    salary_period: SalaryPeriod | None = None

    # 4) Title/keywords
    category: str | None = Field(default=None, max_length=100)
    tags: list[str] | None = None

    # 5) Experience
    years_experience_min: int | None = Field(default=None, ge=0, le=80)
    years_experience_max: int | None = Field(default=None, ge=0, le=80)
    experience_bucket: list[ExperienceBucket] | None = None

    # 6) Education
    education_level: EducationLevel | None = None

    # 7) Skills
    hard_skills: list[str] | None = None
    soft_skills: list[str] | None = None

    # 8) Languages
    languages: list[str] | None = None
    english_level: EnglishLevel | None = None

    # 9) Company type
    company_types: list[CompanyType] | None = None
    company_size: CompanySize | None = None

    # 10) Published date
    published_within: PublishedWithin | None = None

    # 11) Work schedule
    work_schedule: list[WorkSchedule] | None = None

    # 12) Position level
    position_level: PositionLevel | None = None

    # 14) Benefits
    benefits: list[Benefit] | None = None

    # 15) Contract type
    contract_types: list[ContractType] | None = None

    # 16) Hiring speed
    hire_speed: HireSpeed | None = None

    @model_validator(mode="after")
    def _validate_ranges(self) -> "ResumeSearchFilters":
        if (
            self.salary_min is not None
            and self.salary_max is not None
            and self.salary_min > self.salary_max
        ):
            raise ValueError("salary_min must be <= salary_max")
        if (
            self.years_experience_min is not None
            and self.years_experience_max is not None
            and self.years_experience_min > self.years_experience_max
        ):
            raise ValueError("years_experience_min must be <= years_experience_max")
        if self.radius_km is not None and (self.center_lat is None or self.center_lng is None):
            raise ValueError("center_lat and center_lng are required when radius_km is set")
        return self


def _overlap(column, values: Iterable[str]):
    # Postgres ARRAY overlap: column && ARRAY[...]
    return column.op("&&")(list(values))


def _published_since(value: PublishedWithin) -> datetime:
    now = datetime.now(timezone.utc)
    if value == PublishedWithin.H24:
        return now - timedelta(hours=24)
    if value == PublishedWithin.D3:
        return now - timedelta(days=3)
    if value == PublishedWithin.WEEK:
        return now - timedelta(days=7)
    return now - timedelta(days=30)


def apply_resume_search_filters(stmt: Select, f: ResumeSearchFilters) -> Select:
    conditions = []

    # Always: only active resumes in search.
    conditions.append(resumes_table.c.is_active.is_(True))

    if f.city:
        conditions.append(resumes_table.c.city.ilike(f"%{f.city.strip()}%"))
    if f.country:
        conditions.append(resumes_table.c.country.ilike(f"%{f.country.strip()}%"))

    if f.radius_km is not None:
        # Haversine-like distance (km) using DB trig functions.
        lat1 = func.radians(f.center_lat)
        lon1 = func.radians(f.center_lng)
        lat2 = func.radians(resumes_table.c.location_lat)
        lon2 = func.radians(resumes_table.c.location_lng)
        distance_km = 6371.0 * func.acos(
            func.sin(lat1) * func.sin(lat2)
            + func.cos(lat1) * func.cos(lat2) * func.cos(lon2 - lon1)
        )
        conditions.append(resumes_table.c.location_lat.isnot(None))
        conditions.append(resumes_table.c.location_lng.isnot(None))
        conditions.append(distance_km <= f.radius_km)

    if f.work_format:
        conditions.append(_overlap(resumes_table.c.employment_type, [e.value for e in f.work_format]))
    if f.employment_kind:
        conditions.append(_overlap(resumes_table.c.employment_kind, [e.value for e in f.employment_kind]))

    if f.salary_currency:
        conditions.append(resumes_table.c.salary_currency == f.salary_currency)
    if f.salary_period:
        conditions.append(resumes_table.c.salary_period == f.salary_period.value)
    if f.salary_min is not None:
        conditions.append(resumes_table.c.salary_min.isnot(None))
        conditions.append(resumes_table.c.salary_min >= f.salary_min)
    if f.salary_max is not None:
        conditions.append(resumes_table.c.salary_max.isnot(None))
        conditions.append(resumes_table.c.salary_max <= f.salary_max)

    if f.category:
        conditions.append(resumes_table.c.category.ilike(f"%{f.category.strip()}%"))
    if f.tags:
        conditions.append(_overlap(resumes_table.c.tags, [t.strip() for t in f.tags if t.strip()]))

    if f.years_experience_min is not None:
        conditions.append(resumes_table.c.years_experience.isnot(None))
        conditions.append(resumes_table.c.years_experience >= f.years_experience_min)
    if f.years_experience_max is not None:
        conditions.append(resumes_table.c.years_experience.isnot(None))
        conditions.append(resumes_table.c.years_experience <= f.years_experience_max)
    if f.experience_bucket:
        bucket_ors = []
        for b in f.experience_bucket:
            if b == ExperienceBucket.NO_EXPERIENCE:
                bucket_ors.append(resumes_table.c.years_experience == 0)
            elif b == ExperienceBucket.ONE_THREE:
                bucket_ors.append(and_(resumes_table.c.years_experience >= 1, resumes_table.c.years_experience <= 3))
            elif b == ExperienceBucket.THREE_FIVE:
                bucket_ors.append(and_(resumes_table.c.years_experience >= 3, resumes_table.c.years_experience <= 5))
            else:
                bucket_ors.append(resumes_table.c.years_experience >= 5)
        if bucket_ors:
            conditions.append(or_(*bucket_ors))

    if f.education_level:
        conditions.append(resumes_table.c.education_level == f.education_level.value)

    if f.hard_skills:
        conditions.append(_overlap(resumes_table.c.hard_skills, [s.strip() for s in f.hard_skills if s.strip()]))
    if f.soft_skills:
        conditions.append(_overlap(resumes_table.c.soft_skills, [s.strip() for s in f.soft_skills if s.strip()]))

    if f.languages:
        conditions.append(_overlap(resumes_table.c.languages, [s.strip() for s in f.languages if s.strip()]))
    if f.english_level:
        conditions.append(resumes_table.c.english_level == f.english_level.value)

    if f.company_types:
        conditions.append(_overlap(resumes_table.c.company_types, [c.value for c in f.company_types]))
    if f.company_size:
        conditions.append(resumes_table.c.company_size == f.company_size.value)

    if f.published_within:
        conditions.append(resumes_table.c.created_at >= _published_since(f.published_within))

    if f.work_schedule:
        conditions.append(_overlap(resumes_table.c.work_schedule, [w.value for w in f.work_schedule]))
    if f.position_level:
        conditions.append(resumes_table.c.position_level == f.position_level.value)

    if f.benefits:
        conditions.append(_overlap(resumes_table.c.benefits, [b.value for b in f.benefits]))
    if f.contract_types:
        conditions.append(_overlap(resumes_table.c.contract_types, [c.value for c in f.contract_types]))
    if f.hire_speed:
        conditions.append(resumes_table.c.hire_speed == f.hire_speed.value)

    if conditions:
        stmt = stmt.where(and_(*conditions))
    return stmt

