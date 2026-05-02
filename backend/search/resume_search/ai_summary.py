import os
import json
from pathlib import Path
from typing import Any
from dotenv import load_dotenv
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider
import redis.asyncio as redis
from pydantic import ValidationError
from redis.exceptions import RedisError
from search.resume_search.models import ResumeSummary
from logger import logger

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

SYSTEM_PROMPT = """
You are an HR assistant. Analyze the candidate resume and provide:
1. A concise summary (2-3 sentences) of the candidate's profile
2. A list of 3-5 key strengths/skills based on the resume

Language: Ukrainian.

IMPORTANT: Always return both fields. Strengths must be a list of strings, not empty.
""".strip()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
AI_SUMMARY_CACHE_TTL_SECONDS = int(os.getenv("AI_SUMMARY_CACHE_TTL_SECONDS", "86400"))
redis_client = redis.from_url(REDIS_URL, decode_responses=True)


def _format_resume(resume: dict[str, Any]) -> str:
    salary_min = resume.get("salary_min")
    salary_max = resume.get("salary_max")
    salary_currency = resume.get("salary_currency")
    salary = (
        f"{salary_min}-{salary_max} {salary_currency}".strip()
        if salary_min is not None or salary_max is not None or salary_currency
        else ""
    )
    fields = {
        "Title": resume.get("title"),
        "Desired role": resume.get("desired_role"),
        "Summary": resume.get("summary"),
        "Employment type": resume.get("employment_type"),
        "Location": resume.get("location"),
        "Salary": salary,
        "Years of experience": resume.get("years_experience"),
    }
    return "\n".join(
        f"{label}: {', '.join(map(str, value)) if isinstance(value, list) else value}"
        for label, value in fields.items()
        if value not in (None, "", [])
    )


def build_resume_summary_cache_key(
    resume_id: int,
    resume_updated_at: Any,
) -> str:
    version = (
        resume_updated_at.isoformat()
        if hasattr(resume_updated_at, "isoformat")
        else str(resume_updated_at or "none")
    )
    return f"resume:summary:{resume_id}:{version}"


async def get_cached_resume_summary(cache_key: str) -> dict[str, Any] | None:
    try:
        raw = await redis_client.get(cache_key)
        if not raw:
            return None
        parsed = json.loads(raw)
        validated = ResumeSummary.model_validate(parsed)
        return validated.model_dump()
    except (RedisError, json.JSONDecodeError, ValidationError, TypeError, ValueError):
        return None


async def set_cached_resume_summary(cache_key: str, summary: dict[str, Any]) -> None:
    try:
        await redis_client.set(
            cache_key,
            json.dumps(summary, ensure_ascii=False),
            ex=AI_SUMMARY_CACHE_TTL_SECONDS,
        )
    except RedisError:
        return


async def summarize_resume(resume: dict[str, Any]) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")

    provider = OpenAIProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )
    model_name = os.getenv("RESUME_SUMMARY_MODEL", "openai/gpt-4o-mini")
    logger.info(f"Using resume summary model: {model_name}")
    model = OpenAIModel(model_name, provider=provider)

    agent = Agent(
        model,
        system_prompt=SYSTEM_PROMPT,
        model_settings={"max_tokens": 2048},
    )

    result = await agent.run(
        f"Resume data:\n{_format_resume(resume)}",
        output_type=ResumeSummary,
    )
    output = result.output
    print('----------------------------------------------')
    print(output)
    print('----------------------------------------------')
    if isinstance(output, ResumeSummary):
        return output.model_dump()
    return ResumeSummary.model_validate(output).model_dump()
