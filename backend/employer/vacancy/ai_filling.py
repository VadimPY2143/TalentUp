import os
from pathlib import Path
from typing import Any
from dotenv import load_dotenv
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider
from .models import Vacancy

load_dotenv()

SYSTEM_PROMPT = """
You are a senior Ukrainian HR/recruiter assistant.
Generate one complete vacancy JSON from user description.

Hard rules:
1) Market: Ukraine only.
2) Language: same as user request Ukrainian/English (except enum-like fields).
3) Return only one valid JSON object. No markdown, no comments, no extra text.
4) All fields must be filled with meaningful values. Never use null, empty strings, or empty arrays.
5) If some details are missing, infer realistic values from the role and context.
6) Salary must be monthly (for 1 month), integer values only.
7) Salary range must be logical: salary_min <= salary_max.
8) expires_at must be valid ISO datetime in the future.

Field quality requirements:
- title: specific, professional, and market-ready.
- description: detailed and structured, at least 600 characters.
- responsibilities: one string with 8-12 clear bullet points.
- requirements: one string with 8-12 clear bullet points.
- is_active: true by default.
- employment_type: choose from "Full-time" or "Part-time".
- location: real Ukrainian city or "Ukraine (Remote)".
- salary_currency: use "UAH" for Ukrainian market unless user explicitly asks another currency.
- experience_years_min / experience_years_max: realistic and consistent with title.
- work_format: choose from "Remote", "Hybrid", "Office".
""".strip()


async def generate_vacancy(vacancy_description: str) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Set OPENAI_API_KEY in requirements.txt")

    provider = OpenAIProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )
    model = OpenAIModel("openai/gpt-4o-mini", provider=provider)
    agent = Agent(model, system_prompt=SYSTEM_PROMPT)

    result = await agent.run(
        f"Description: {vacancy_description}",
        output_type=Vacancy,
    )
    output = result.output
    if isinstance(output, Vacancy):
        return output.model_dump()
    return Vacancy.model_validate(output).model_dump()
