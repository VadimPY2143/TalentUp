import os
from pathlib import Path
from typing import Any
from dotenv import load_dotenv
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider
from search.resume_search.models import ResumeSummary

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

SYSTEM_PROMPT = """
You are an HR assistant. Summarize the candidate resume and highlight key strengths.
Language: Ukrainian.
""".strip()


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


async def summarize_resume(resume: dict[str, Any]) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")

    provider = OpenAIProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )
    model = OpenAIModel("openai/gpt-4o-mini", provider=provider)
    agent = Agent(
        model,
        system_prompt=SYSTEM_PROMPT,
    )

    result = await agent.run(
        f"Resume data:\n{_format_resume(resume)}",
        output_type=ResumeSummary,
    )
    output = result.output
    if isinstance(output, ResumeSummary):
        return output.model_dump()
    return ResumeSummary.model_validate(output).model_dump()
