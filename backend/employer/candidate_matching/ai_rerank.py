import asyncio
import os
import logging
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider

from employer.candidate_matching.models import (
    CandidateBatchRerankOutput,
    CandidateRerankOutput,
)
from logger import logger

logging.basicConfig(level=logging.INFO)

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

SYSTEM_PROMPT = """
You are an experienced HR recruiter for Ukrainian market.
Evaluate how well each candidate resume matches a vacancy.
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

Batch rules:
- Return JSON object with key "results" only.
- Every item in "results" must include application_id from input candidates.
- Return each input application_id exactly once.
- Do not include unknown application_id values.

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
        "Application ID": candidate.get("application_id"),
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


def _format_candidates(candidates: list[dict[str, Any]]) -> str:
    return "\n\n".join(
        f"Candidate #{index}\n{_format_candidate(candidate)}"
        for index, candidate in enumerate(candidates, start=1)
    )


def _build_agent() -> Agent:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required for candidate matching")

    provider = OpenAIProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )
    model_name = os.getenv("CANDIDATE_MATCH_MODEL", "openrouter/free")
    logger.info(f"Using candidate match model: {model_name}")
    model = OpenAIModel(model_name, provider=provider)
    return Agent(model, system_prompt=SYSTEM_PROMPT)


def _get_rerank_timeout_seconds() -> float:
    raw_value = os.getenv("CANDIDATE_MATCH_TIMEOUT_SECONDS", "90")
    try:
        timeout_seconds = float(raw_value)
    except (TypeError, ValueError):
        timeout_seconds = 90.0
    return max(5.0, timeout_seconds)


async def rerank_candidates(
    vacancy: dict[str, Any],
    candidates: list[dict[str, Any]],
) -> dict[int, CandidateRerankOutput]:
    if not candidates:
        return {}

    model_name = os.getenv("CANDIDATE_MATCH_MODEL", "openrouter/free")
    logger.info(f"Starting candidate batch rerank with model: {model_name}")
    agent = _build_agent()
    prompt = (
        f"Vacancy:\n{_format_vacancy(vacancy)}\n\n"
        f"Candidates:\n{_format_candidates(candidates)}"
    )
    timeout_seconds = _get_rerank_timeout_seconds()
    try:
        result = await asyncio.wait_for(
            agent.run(
                prompt,
                output_type=CandidateBatchRerankOutput,
                model_settings={"max_tokens": 4096},
            ),
            timeout=timeout_seconds,
        )
    except asyncio.TimeoutError as exc:
        raise RuntimeError(
            f"Candidate batch rerank timed out after {int(timeout_seconds)}s"
        ) from exc

    output = result.output
    if isinstance(output, CandidateBatchRerankOutput):
        batch_output = output
    else:
        batch_output = CandidateBatchRerankOutput.model_validate(output)

    known_ids = {
        int(candidate["application_id"])
        for candidate in candidates
        if candidate.get("application_id") is not None
    }
    mapped: dict[int, CandidateRerankOutput] = {}
    for item in batch_output.results:
        application_id = int(item.application_id)
        if application_id not in known_ids:
            continue
        if application_id in mapped:
            continue
        mapped[application_id] = CandidateRerankOutput.model_validate(
            item.model_dump(exclude={"application_id"})
        )

    return mapped
