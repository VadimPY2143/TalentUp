import json
import os
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(
    api_key=os.getenv("API_KEY"),
    base_url="https://openrouter.ai/api/v1",
)

SYSTEM_PROMPT = """
You are an HR assistant. Summarize the candidate resume and highlight key strengths.
Return ONLY valid JSON in the following format:
{
  "summary": "2-3 short sentences",
  "strengths": ["3-6 short bullet points"]
}
Language: Ukrainian.
""".strip()


def _format_resume(resume: dict[str, Any]) -> str:
    def to_text(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, list):
            return ", ".join(str(item) for item in value if item is not None)
        return str(value)

    fields = [
        ("Title", resume.get("title")),
        ("Desired role", resume.get("desired_role")),
        ("Summary", resume.get("summary")),
        ("Employment type", resume.get("employment_type")),
        ("Location", resume.get("location")),
        (
            "Salary",
            f"{resume.get('salary_min')}-{resume.get('salary_max')} {resume.get('salary_currency')}",
        ),
        ("Years of experience", resume.get("years_experience")),
    ]
    return "\n".join(
        f"{label}: {to_text(value)}" for label, value in fields if to_text(value)
    )


def _extract_json_object(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("AI response does not contain JSON")
    return text[start : end + 1]


async def summarize_resume(resume: dict[str, Any]) -> dict[str, Any]:
    resume_text = _format_resume(resume)
    response = client.chat.completions.create(
        model="anthropic/claude-3-haiku",
        temperature=0.4,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Resume data:\n{resume_text}"},
        ],
    )
    content = response.choices[0].message.content or ""
    if not content:
        raise ValueError("AI response is empty")

    data = json.loads(_extract_json_object(content))
    summary = str(data.get("summary", "")).strip()
    strengths = data.get("strengths") or []
    return {"summary": summary, "strengths": strengths}
