import os
from pathlib import Path
from typing import Any
from dotenv import load_dotenv
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider
from .models import Vacancy, VacancyAIFillOutput
from logger import logger

load_dotenv()

SYSTEM_PROMPT = """
You are a senior Ukrainian HR assistant.
Generate one complete vacancy JSON from user description.

Hard rules:
1) Market: Ukraine only.
2) Language: same as user request Ukrainian/English (except enum-like fields).
3) Return only one valid JSON object. No markdown, no comments, no extra text.
4) All fields must be filled with meaningful values. Never use null, empty strings, or empty arrays.
5) If some details are missing, infer realistic values from the role and context. Every field must be filled.
6) Salary must be monthly (for 1 month), integer values only.
7) Salary range must be logical: salary_min <= salary_max.

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
    model_name = os.getenv("VACANCY_AI_FILL_MODEL", "google/gemma-3-12b-it")
    logger.info(f"Using vacancy AI fill model: {model_name}")
    model = OpenAIModel(model_name, provider=provider)
    agent = Agent(model, system_prompt=SYSTEM_PROMPT)

    result = await agent.run(
        f"Description: {vacancy_description}",
        output_type=VacancyAIFillOutput,
        model_settings={"max_tokens": 3072},
    )
    output = result.output
    if isinstance(output, VacancyAIFillOutput):
        parsed = output
    else:
        parsed = VacancyAIFillOutput.model_validate(output)
    return Vacancy.model_validate(parsed.model_dump()).model_dump()
