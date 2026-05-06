from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field, model_validator


class AnalyticsEventType(str, Enum):
    profile_view = "profile_view"
    resume_view = "resume_view"
    contact_click = "contact_click"


class AnalyticsEventIn(BaseModel):
    event_type: AnalyticsEventType
    target_user_id: int | None = Field(default=None, ge=1)
    target_resume_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def _validate_targets(self) -> "AnalyticsEventIn":
        if self.event_type == AnalyticsEventType.profile_view and not self.target_user_id:
            raise ValueError("target_user_id is required for profile_view")
        if self.event_type == AnalyticsEventType.resume_view and not self.target_resume_id:
            raise ValueError("target_resume_id is required for resume_view")
        return self


class AnalyticsEventOut(BaseModel):
    status: str
    inserted: bool


class AnalyticsOverviewOut(BaseModel):
    from_dt: datetime
    to_dt: datetime
    profile_views: int
    profile_viewers_unique: int
    resume_views: int
    resume_viewers_unique: int
    applications_sent: int
    applications_by_status: dict[str, int]


class AnalyticsTimeseriesPointOut(BaseModel):
    day: date
    profile_views: int = 0
    resume_views: int = 0
    applications_sent: int = 0


class AnalyticsFunnelStepOut(BaseModel):
    step: str
    count: int


class AnalyticsApplicationRowOut(BaseModel):
    id: int
    vacancy_id: int
    vacancy_title: str | None = None
    company_id: int | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class AnalyticsDashboardOut(BaseModel):
    overview: AnalyticsOverviewOut
    timeseries: list[AnalyticsTimeseriesPointOut]
    funnel: list[AnalyticsFunnelStepOut]
    applications: list[AnalyticsApplicationRowOut]

