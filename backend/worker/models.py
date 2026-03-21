from enum import Enum
from typing import List, Optional
from pydantic import BaseModel

class EmploymentType(str, Enum):
    REMOTE = "Remote"
    OFFICE = "Office"
    HYBRID = "Hybrid"

class EmploymentKind(str, Enum):
    FULL_TIME = "Full-time"
    PART_TIME = "Part-time"
    CONTRACT = "Contract"
    INTERNSHIP = "Internship"
    TEMPORARY = "Temporary"

class CurrencyType(str, Enum):
    USD = "USD"
    EUR = "EUR"
    UAH = "UAH"

class SalaryPeriod(str, Enum):
    MONTH = "month"
    YEAR = "year"
    HOUR = "hour"

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

class WorkSchedule(str, Enum):
    FLEXIBLE = "Flexible"
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

class Resume(BaseModel):
    title: str
    summary: Optional[str] = None
    desired_role: Optional[str] = None
    employment_type: List[EmploymentType]
    employment_kind: Optional[List[EmploymentKind]] = None
    location: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: CurrencyType = CurrencyType.UAH
    salary_period: Optional[SalaryPeriod] = None
    years_experience: Optional[int] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    education_level: Optional[EducationLevel] = None
    hard_skills: Optional[List[str]] = None
    soft_skills: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    english_level: Optional[EnglishLevel] = None
    company_types: Optional[List[CompanyType]] = None
    company_size: Optional[CompanySize] = None
    work_schedule: Optional[List[WorkSchedule]] = None
    position_level: Optional[PositionLevel] = None
    contract_types: Optional[List[ContractType]] = None
    benefits: Optional[List[Benefit]] = None
    hire_speed: Optional[HireSpeed] = None
    is_active: bool = True


class ResumeUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    desired_role: Optional[str] = None
    employment_type: Optional[List[EmploymentType]] = None
    employment_kind: Optional[List[EmploymentKind]] = None
    location: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: Optional[CurrencyType] = None
    salary_period: Optional[SalaryPeriod] = None
    years_experience: Optional[int] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    education_level: Optional[EducationLevel] = None
    hard_skills: Optional[List[str]] = None
    soft_skills: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    english_level: Optional[EnglishLevel] = None
    company_types: Optional[List[CompanyType]] = None
    company_size: Optional[CompanySize] = None
    work_schedule: Optional[List[WorkSchedule]] = None
    position_level: Optional[PositionLevel] = None
    contract_types: Optional[List[ContractType]] = None
    benefits: Optional[List[Benefit]] = None
    hire_speed: Optional[HireSpeed] = None
    is_active: Optional[bool] = None
