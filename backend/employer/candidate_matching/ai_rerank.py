import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider

from employer.candidate_matching.models import CandidateRerankOutput

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

SYSTEM_PROMPT = """
You are an experienced HR recruiter for Ukrainian market.
Evaluate how well a candidate resume matches a vacancy.
Return only valid JSON according to schema.

Scoring rules:
- score_total: integer from 0 to 100
- confidence: float from 0.0 to 1.0
- verdict: one of strong_match, match, weak_match, mismatch
- matched_skills: concrete overlapping skills/keywords
- missing_skills: important skills from vacancy not covered by resume
- strengths: 2-6 concise strong points
- risks: 0-6 concise concerns
- summary: concise explanation in Ukrainian (1-3 sentences)

Be strict and avoid inflated scores.
""".strip()


def _format_vacancy(vacancy: dict[str, Any]) -> str:
    fields = {
        "Title": vacancy.get("title"),
        "Description": vacancy.get("description"),
        "Responsibilities": vacancy.get("responsibilities"),
        "Requirements": vacancy.get("requirements"),
        "Employment type": vacancy.get("employment_type"),
        "Work format": vacancy.get("work_format"),
        "Location": vacancy.get("location"),
        "Experience min": vacancy.get("experience_years_min"),
        "Experience max": vacancy.get("experience_years_max"),
        "Salary min": vacancy.get("salary_min"),
        "Salary max": vacancy.get("salary_max"),
        "Salary currency": vacancy.get("salary_currency"),
    }
    return "\n".join(
        f"{label}: {', '.join(map(str, value)) if isinstance(value, list) else value}"
        for label, value in fields.items()
        if value not in (None, "", [])
    )


def _format_candidate(candidate: dict[str, Any]) -> str:
    fields = {
        "Candidate name": candidate.get("candidate_name"),
        "Resume title": candidate.get("resume_title"),
        "Desired role": candidate.get("desired_role"),
        "Summary": candidate.get("resume_summary"),
        "Employment type": candidate.get("employment_type"),
        "Location": candidate.get("location"),
        "Years of experience": candidate.get("years_experience"),
        "Salary min": candidate.get("salary_min"),
        "Salary max": candidate.get("salary_max"),
        "Salary currency": candidate.get("salary_currency"),
        "Cover letter": candidate.get("cover_letter"),
    }
    return "\n".join(
        f"{label}: {', '.join(map(str, value)) if isinstance(value, list) else value}"
        for label, value in fields.items()
        if value not in (None, "", [])
    )


def _build_agent() -> Agent:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required for candidate matching")

    provider = OpenAIProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )
    model_name = os.getenv("CANDIDATE_MATCH_MODEL", "openai/gpt-4o")
    model = OpenAIModel("openai/gpt-4o", provider=provider)
    return Agent(model, system_prompt=SYSTEM_PROMPT)


async def rerank_candidate(
    vacancy: dict[str, Any],
    candidate: dict[str, Any],
) -> CandidateRerankOutput:
    agent = _build_agent()
    prompt = (
        f"Vacancy:\n{_format_vacancy(vacancy)}\n\n"
        f"Candidate resume:\n{_format_candidate(candidate)}"
    )
    result = await agent.run(prompt,
                             output_type=CandidateRerankOutput,
                             model_settings={"max_tokens": 2048})
    output = result.output
    if isinstance(output, CandidateRerankOutput):
        return output
    return CandidateRerankOutput.model_validate(output)

