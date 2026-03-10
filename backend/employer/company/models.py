from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class Company(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    legal_name: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    industry: Optional[str] = Field(default=None, max_length=100)
    company_size: Optional[str] = Field(default=None, max_length=50)
    website: Optional[str] = Field(default=None, max_length=255)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    country: Optional[str] = Field(default=None, max_length=100)
    city: Optional[str] = Field(default=None, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)
    founded_year: Optional[int] = Field(default=None, ge=1800, le=2100)
    logo_url: Optional[str] = Field(default=None, max_length=500)


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    legal_name: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    industry: Optional[str] = Field(default=None, max_length=100)
    company_size: Optional[str] = Field(default=None, max_length=50)
    website: Optional[str] = Field(default=None, max_length=255)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    country: Optional[str] = Field(default=None, max_length=100)
    city: Optional[str] = Field(default=None, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)
    founded_year: Optional[int] = Field(default=None, ge=1800, le=2100)
    logo_url: Optional[str] = Field(default=None, max_length=500)


class CompanyResponse(Company):
    id: int
    user_id: int
    is_verified: bool
    created_at: datetime
    updated_at: datetime