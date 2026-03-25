from pydantic import BaseModel


class ResumeSummary(BaseModel):
    summary: str
    strengths: list[str]


class ResumeSummaryResponse(ResumeSummary):
    cached: bool
