from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


MatchJobStatus = Literal["pending", "running", "done", "failed"]


class CandidateMatchRunRequest(BaseModel):
    requested_limit: int = Field(default=3, ge=1, le=10)


class CandidateMatchRunResponse(BaseModel):
    job_id: str
    vacancy_id: int
    status: MatchJobStatus
    requested_limit: int


class CandidateMatchResultItem(BaseModel):
    rank: int = Field(ge=1)
    application_id: int
    resume_id: int
    candidate_user_id: int
    candidate_name: str
    title: str
    desired_role: str | None = None
    years_experience: int | None = None
    location: str | None = None
    employment_type: list[str] = Field(default_factory=list)
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str | None = None
    cover_letter: str | None = None
    score_total: int = Field(ge=0, le=100)
    score_sql: int = Field(ge=0, le=100)
    confidence: float = Field(ge=0.0, le=1.0)
    verdict: str
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    summary: str


class CandidateMatchJobResponse(BaseModel):
    job_id: str
    vacancy_id: int
    created_by_user_id: int
    status: MatchJobStatus
    requested_limit: int
    prefiltered_count: int | None = None
    scored_count: int | None = None
    created_at: datetime
    updated_at: datetime
    error: str | None = None
    result: list[CandidateMatchResultItem] = Field(default_factory=list)


class CandidateRerankOutput(BaseModel):
    score_total: int = Field(ge=0, le=100)
    confidence: float = Field(ge=0.0, le=1.0)
    verdict: Literal["strong_match", "match", "weak_match", "mismatch"]
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    summary: str = Field(min_length=10, max_length=400)
