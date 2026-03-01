from enum import Enum
from typing import List, Optional
from pydantic import BaseModel

class EmploymentType(str, Enum):
    REMOTE = "Remote"
    OFFICE = "Office"
    HYBRID = "Hybrid"

class CurrencyType(str, Enum):
    USD = "USD"
    EUR = "EUR"
    UAH = "UAH"

class Resume(BaseModel):
    title: str
    summary: Optional[str] = None
    desired_role: Optional[str] = None
    employment_type: List[EmploymentType]
    location: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: CurrencyType = CurrencyType.UAH
    years_experience: Optional[int] = None
    is_active: bool = True
