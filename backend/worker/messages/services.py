from datetime import datetime, timedelta, timezone
from html import escape
import os
from typing import Any
from urllib.parse import urlencode

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import vacancies_table
from search.vacancy_search.filters import (
    EmploymentKind,
    VacancySearchFilters,
    WorkFormat,
    apply_vacancy_search_filters,
)
from search.vacancy_search.views import _build_vacancy_conditions

from .models import (
    INT32_MAX,
    VacancySubscriptionCreateIn,
    VacancySubscriptionFilters,
    VacancySubscriptionOut,
    VacancySubscriptionUpdateIn,
)
from .repositories import VacancySubscriptionRepository


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _subscription_interval() -> timedelta:
    minutes = int(os.getenv("VACANCY_DIGEST_INTERVAL_MINUTES", "10080"))
    if minutes <= 0:
        minutes = 10080
    return timedelta(minutes=minutes)


def _frontend_origin() -> str:
    return os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").rstrip("/")


def _vacancy_url(vacancy_id: int, search_text: str) -> str:
    query = urlencode({"vacancyId": vacancy_id, "query": search_text})
    return f"{_frontend_origin()}/jobs?{query}"


def _jobs_url(search_text: str) -> str:
    query = urlencode({"query": search_text})
    return f"{_frontend_origin()}/jobs?{query}"


def _clamp_int(value: Any, *, min_value: int, max_value: int) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed < min_value:
        return min_value
    if parsed > max_value:
        return max_value
    return parsed


def _normalize_legacy_filters(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}

    normalized: dict[str, Any] = {}

    city_id = _clamp_int(raw.get("city_id"), min_value=1, max_value=INT32_MAX)
    if city_id is not None:
        normalized["city_id"] = city_id

    company_id = _clamp_int(raw.get("company_id"), min_value=1, max_value=INT32_MAX)
    if company_id is not None:
        normalized["company_id"] = company_id

    location = raw.get("location")
    if isinstance(location, str):
        location = location.strip()
        if location:
            normalized["location"] = location[:255]

    salary_min = _clamp_int(raw.get("salary_min"), min_value=0, max_value=INT32_MAX)
    salary_max = _clamp_int(raw.get("salary_max"), min_value=0, max_value=INT32_MAX)
    if salary_min is not None:
        normalized["salary_min"] = salary_min
    if salary_max is not None:
        normalized["salary_max"] = salary_max

    experience_years_min = _clamp_int(raw.get("experience_years_min"), min_value=0, max_value=80)
    experience_years_max = _clamp_int(raw.get("experience_years_max"), min_value=0, max_value=80)
    if experience_years_min is not None:
        normalized["experience_years_min"] = experience_years_min
    if experience_years_max is not None:
        normalized["experience_years_max"] = experience_years_max

    salary_currency = raw.get("salary_currency")
    if isinstance(salary_currency, str):
        salary_currency = salary_currency.strip()
        if salary_currency:
            normalized["salary_currency"] = salary_currency[:10]

    raw_employment = raw.get("employment_kind")
    if isinstance(raw_employment, list):
        allowed = {item.value for item in EmploymentKind}
        values = [value for value in raw_employment if isinstance(value, str) and value in allowed]
        if values:
            normalized["employment_kind"] = values

    raw_work_format = raw.get("work_format")
    if isinstance(raw_work_format, list):
        allowed = {item.value for item in WorkFormat}
        values = [value for value in raw_work_format if isinstance(value, str) and value in allowed]
        if values:
            normalized["work_format"] = values

    exclude_expired = raw.get("exclude_expired")
    if isinstance(exclude_expired, bool):
        normalized["exclude_expired"] = exclude_expired
    else:
        normalized["exclude_expired"] = True

    return normalized


class VacancySubscriptionService:
    def __init__(self, repository: VacancySubscriptionRepository):
        self.repository = repository

    @staticmethod
    def _normalize_search_text(value: str) -> str:
        text = value.strip()
        if len(text) < 2:
            raise HTTPException(status_code=400, detail="search_text must contain at least 2 characters")
        return text

    @staticmethod
    def _build_out(row: dict[str, Any]) -> VacancySubscriptionOut:
        payload = dict(row)
        raw_filters = payload.get("filters") or {}
        try:
            payload["filters"] = VacancySubscriptionFilters.model_validate(raw_filters)
        except ValidationError:
            payload["filters"] = VacancySubscriptionFilters.model_validate(
                _normalize_legacy_filters(raw_filters)
            )
        return VacancySubscriptionOut(**payload)

    async def create(
        self,
        session: AsyncSession,
        *,
        current_user: dict[str, Any],
        payload: VacancySubscriptionCreateIn,
    ) -> VacancySubscriptionOut:
        email = str(current_user.get("email") or "").strip()
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        next_run_at = payload.next_run_at or (datetime.now(timezone.utc) + _subscription_interval())
        next_run_at = _ensure_utc(next_run_at)

        row = await self.repository.create_subscription(
            session=session,
            user_id=current_user["id"],
            email=email,
            search_text=self._normalize_search_text(payload.search_text),
            filters=payload.filters.model_dump(mode="json", exclude_none=True),
            next_run_at=next_run_at,
            is_active=payload.is_active,
        )
        await session.commit()
        return self._build_out(row)

    async def list_by_user(
        self,
        session: AsyncSession,
        *,
        user_id: int,
    ) -> list[VacancySubscriptionOut]:
        rows = await self.repository.list_subscriptions_by_user(session=session, user_id=user_id)
        return [self._build_out(row) for row in rows]

    async def get_owned(
        self,
        session: AsyncSession,
        *,
        subscription_id: int,
        user_id: int,
    ) -> VacancySubscriptionOut:
        row = await self.repository.get_owned_subscription(
            session=session,
            subscription_id=subscription_id,
            user_id=user_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Subscription not found")
        return self._build_out(row)

    async def update(
        self,
        session: AsyncSession,
        *,
        subscription_id: int,
        user_id: int,
        payload: VacancySubscriptionUpdateIn,
    ) -> VacancySubscriptionOut:
        values = payload.model_dump(exclude_unset=True, exclude={"filters"})
        if not values:
            if payload.filters is None:
                raise HTTPException(status_code=400, detail="No fields to update")

        if "search_text" in values and values["search_text"] is not None:
            values["search_text"] = self._normalize_search_text(values["search_text"])
        if payload.filters is not None:
            values["filters"] = payload.filters.model_dump(mode="json", exclude_none=True)
        if "next_run_at" in values and values["next_run_at"] is not None:
            values["next_run_at"] = _ensure_utc(values["next_run_at"])

        row = await self.repository.update_owned_subscription(
            session=session,
            subscription_id=subscription_id,
            user_id=user_id,
            values=values,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Subscription not found")
        await session.commit()
        return self._build_out(row)

    async def delete(
        self,
        session: AsyncSession,
        *,
        subscription_id: int,
        user_id: int,
    ) -> None:
        deleted = await self.repository.delete_owned_subscription(
            session=session,
            subscription_id=subscription_id,
            user_id=user_id,
        )
        if not deleted:
            raise HTTPException(status_code=404, detail="Subscription not found")
        await session.commit()


class VacancyDigestService:
    async def find_new_vacancies(
        self,
        session: AsyncSession,
        *,
        subscription: dict[str, Any],
        period_start: datetime,
        period_end: datetime,
    ) -> list[dict[str, Any]]:
        term = str(subscription.get("search_text") or "").strip()
        tokens = [token for token in term.split() if len(token) >= 2]
        if not tokens:
            return []

        conditions = _build_vacancy_conditions(tokens)
        filters_payload = _normalize_legacy_filters(subscription.get("filters") or {})
        filters_payload["exclude_expired"] = True
        filters_payload.pop("published_within", None)
        filters = VacancySearchFilters.model_validate(filters_payload)

        stmt = select(vacancies_table)
        stmt = apply_vacancy_search_filters(stmt, filters)
        stmt = (
            stmt.where(vacancies_table.c.is_active.is_(True))
            .where(or_(*conditions))
            .where(vacancies_table.c.created_at > period_start)
            .where(vacancies_table.c.created_at <= period_end)
            .order_by(vacancies_table.c.created_at.desc(), vacancies_table.c.id.desc())
        )
        result = await session.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    @staticmethod
    def build_subject(search_text: str, vacancies_count: int) -> str:
        return f"TalentUp weekly vacancies: {search_text} ({vacancies_count})"

    @staticmethod
    def build_text_body(
        search_text: str,
        vacancies: list[dict[str, Any]],
        period_start: datetime,
        period_end: datetime,
    ) -> str:
        jobs_url = _jobs_url(search_text)
        lines = [
            f"New vacancies for query: {search_text}",
            f"Period: {period_start.isoformat()} - {period_end.isoformat()}",
            f"Open all results: {jobs_url}",
            "",
        ]
        for vacancy in vacancies:
            salary_min = vacancy.get("salary_min")
            salary_max = vacancy.get("salary_max")
            currency = vacancy.get("salary_currency") or ""
            salary = "not specified"
            if salary_min is not None or salary_max is not None:
                left = salary_min if salary_min is not None else "?"
                right = salary_max if salary_max is not None else "?"
                salary = f"{left} - {right} {currency}".strip()
            location = vacancy.get("location") or "location not specified"
            vacancy_id = int(vacancy.get("id"))
            lines.append(f"- {vacancy.get('title')} | {location} | {salary}")
            lines.append(f"  Open vacancy: {_vacancy_url(vacancy_id, search_text)}")
        return "\n".join(lines)

    @staticmethod
    def build_html_body(
        search_text: str,
        vacancies: list[dict[str, Any]],
        period_start: datetime,
        period_end: datetime,
    ) -> str:
        jobs_url = _jobs_url(search_text)
        cards: list[str] = []
        for vacancy in vacancies:
            salary_min = vacancy.get("salary_min")
            salary_max = vacancy.get("salary_max")
            currency = vacancy.get("salary_currency") or ""
            salary = "not specified"
            if salary_min is not None or salary_max is not None:
                left = salary_min if salary_min is not None else "?"
                right = salary_max if salary_max is not None else "?"
                salary = f"{left} - {right} {currency}".strip()
            title = escape(str(vacancy.get("title") or "Untitled vacancy"))
            location = escape(str(vacancy.get("location") or "location not specified"))
            vacancy_id = int(vacancy.get("id"))
            vacancy_url = escape(_vacancy_url(vacancy_id, search_text))
            cards.append(
                "<div style='border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin:0 0 12px;'>"
                f"<div style='font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px;'>{title}</div>"
                f"<div style='font-size:13px;color:#334155;margin:0 0 4px;'>Location: {location}</div>"
                f"<div style='font-size:13px;color:#334155;margin:0 0 12px;'>Salary: {escape(salary)}</div>"
                f"<a href='{vacancy_url}' "
                "style='display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;"
                "padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;'>"
                "Open Vacancy"
                "</a>"
                "</div>"
            )
        joined_cards = "".join(cards)
        escaped_jobs_url = escape(jobs_url)
        return (
            "<html><body style='font-family:Arial,sans-serif;background:#f8fafc;padding:20px;color:#0f172a;'>"
            "<div style='max-width:720px;margin:0 auto;background:#ffffff;border-radius:14px;"
            "padding:20px;border:1px solid #e2e8f0;'>"
            "<div style='font-size:20px;font-weight:700;margin:0 0 8px;'>TalentUp Weekly Digest</div>"
            f"<div style='font-size:14px;margin:0 0 6px;'>Query: <strong>{escape(search_text)}</strong></div>"
            f"<div style='font-size:12px;color:#475569;margin:0 0 14px;'>Period: {escape(period_start.isoformat())} - {escape(period_end.isoformat())}</div>"
            f"<div style='margin:0 0 14px;'><a href='{escaped_jobs_url}' "
            "style='display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;"
            "padding:9px 14px;border-radius:8px;font-size:13px;font-weight:600;'>"
            "Open All Results"
            "</a></div>"
            f"{joined_cards}"
            "<div style='font-size:12px;color:#64748b;margin-top:12px;'>"
            "You are receiving this email because you subscribed to weekly vacancy updates."
            "</div>"
            "</div>"
            "</body></html>"
        )
