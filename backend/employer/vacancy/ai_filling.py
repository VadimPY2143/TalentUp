import json
import os
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(
    api_key=os.getenv("API_KEY"),
    base_url="https://openrouter.ai/api/v1"
)

SYSTEM_PROMPT = """
Your task is to fill vacancy JSON from the vacancy description.
Return only valid JSON in the same language as request (except enum-like fields).
Every field should be filled. If user doesn't provide it in the prompt you need to generate it by yourself based on other data.
{
  "title": "string",
  "description": "string",
  "responsibilities": "string",
  "requirements": "string",
  "is_active": true,
  "employment_type": [
    "Full-time"/"Part-time"
  ],
  "location": "string",
  "salary_min": 0,
  "salary_max": 0,
  "salary_currency": "string",
  "experience_years_min": 0,
  "experience_years_max": 0,
  "work_format": [
    "Remote"/"Hybrid"/"Office"
  ],
  "expires_at": "2026-03-06T22:44:42.336Z"
}
"""

def _extract_json_block(content: str) -> str:
    stripped = content.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if len(lines) >= 3:
            lines = lines[1:]
            if lines and lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            stripped = "\n".join(lines).strip()
    return stripped


def _extract_json_object(content: str) -> str:
    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return ""
    return content[start:end + 1].strip()


async def generate_vacancy(vacancy_description: str) -> dict[str, Any]:
    response = client.chat.completions.create(
        model="anthropic/claude-3-haiku",
        temperature=0.4,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Description: {vacancy_description}"}
        ],
    )
    content = response.choices[0].message.content or ""
    cleaned = _extract_json_block(content)
    if not cleaned:
        raise ValueError("Empty AI response")

    json_text = _extract_json_object(cleaned) or cleaned
    if not json_text:
        raise ValueError("AI response does not contain JSON")

    try:
        return json.loads(json_text)
    except json.JSONDecodeError as exc:
        raise ValueError("AI returned invalid JSON") from exc
