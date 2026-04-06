from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import (
    analytics_events_table,
    get_session,
    job_applications_table,
    resumes_table,
    vacancies_table,
)
from users.auth import get_current_user
from users.define_roles import require_roles

from .models import (
    AnalyticsDashboardOut,
    AnalyticsEventIn,
    AnalyticsEventOut,
    AnalyticsEventType,
    AnalyticsFunnelStepOut,
    AnalyticsOverviewOut,
    AnalyticsTimeseriesPointOut,
    AnalyticsApplicationRowOut,
)


router = APIRouter(prefix="/analytics", tags=["analytics"])


def _utc_now() -> datetime:
    return datetime.utcnow()


def _clamp_days(days: int) -> int:
    return max(1, min(int(days), 365))


async def _get_worker_resume_ids(session: AsyncSession, user_id: int) -> list[int]:
    stmt = select(resumes_table.c.id).where(resumes_table.c.user_id == user_id)
    result = await session.execute(stmt)
    return [int(r[0]) for r in result.all()]


@router.post("/events", response_model=AnalyticsEventOut)
async def create_event(
    payload: AnalyticsEventIn,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> AnalyticsEventOut:
    actor_user_id = int(current_user["id"])
    target_user_id = payload.target_user_id
    target_resume_id = payload.target_resume_id

    if payload.event_type == AnalyticsEventType.resume_view:
        stmt = select(resumes_table.c.user_id).where(resumes_table.c.id == target_resume_id)
        res = await session.execute(stmt)
        owner_id = res.scalar_one_or_none()
        if owner_id is None:
            raise HTTPException(status_code=404, detail="Resume not found")
        target_user_id = int(owner_id)

    if target_user_id is not None and int(target_user_id) == actor_user_id:
        return AnalyticsEventOut(status="ok", inserted=False)

    if payload.event_type != AnalyticsEventType.resume_view:
        window_start = _utc_now() - timedelta(minutes=10)
        exists_stmt = (
            select(analytics_events_table.c.id)
            .where(
                analytics_events_table.c.actor_user_id == actor_user_id,
                analytics_events_table.c.event_type == payload.event_type.value,
                analytics_events_table.c.target_user_id.is_(target_user_id)
                if target_user_id is None
                else analytics_events_table.c.target_user_id == int(target_user_id),
                analytics_events_table.c.target_resume_id.is_(target_resume_id)
                if target_resume_id is None
                else analytics_events_table.c.target_resume_id == int(target_resume_id),
                analytics_events_table.c.occurred_at >= window_start,
            )
            .limit(1)
        )
        exists = (await session.execute(exists_stmt)).scalar_one_or_none()
        if exists is not None:
            return AnalyticsEventOut(status="ok", inserted=False)

    await session.execute(
        insert(analytics_events_table).values(
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
            target_resume_id=target_resume_id,
            event_type=payload.event_type.value,
        )
    )
    await session.commit()
    return AnalyticsEventOut(status="ok", inserted=True)


class _DaysQuery(BaseModel):
    days: int = 30


@router.get("/dashboard", response_model=AnalyticsDashboardOut)
async def dashboard(
    days: int = Query(30, ge=1, le=365),
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> AnalyticsDashboardOut:

    days = _clamp_days(days)
    to_dt = _utc_now()
    from_dt = to_dt - timedelta(days=days)
    worker_user_id = int(current_user["id"])

    resume_ids = await _get_worker_resume_ids(session=session, user_id=worker_user_id)

    pv_stmt = select(
        func.count(analytics_events_table.c.id).label("total"),
        func.count(func.distinct(analytics_events_table.c.actor_user_id)).label("uniq"),
    ).where(
        analytics_events_table.c.event_type == AnalyticsEventType.profile_view.value,
        analytics_events_table.c.target_user_id == worker_user_id,
        analytics_events_table.c.occurred_at >= from_dt,
        analytics_events_table.c.occurred_at < to_dt,
    )
    pv_row = (await session.execute(pv_stmt)).mappings().one()

    if resume_ids:
        rv_stmt = select(
            func.count(analytics_events_table.c.id).label("total"),
            func.count(func.distinct(analytics_events_table.c.actor_user_id)).label("uniq"),
        ).where(
            analytics_events_table.c.event_type == AnalyticsEventType.resume_view.value,
            analytics_events_table.c.target_resume_id.in_(resume_ids),
            analytics_events_table.c.occurred_at >= from_dt,
            analytics_events_table.c.occurred_at < to_dt,
        )
        rv_row = (await session.execute(rv_stmt)).mappings().one()
    else:
        rv_row = {"total": 0, "uniq": 0}

    apps_total_stmt = select(func.count(job_applications_table.c.id)).where(
        job_applications_table.c.user_id == worker_user_id,
        job_applications_table.c.created_at >= from_dt,
        job_applications_table.c.created_at < to_dt,
    )
    applications_sent = int((await session.execute(apps_total_stmt)).scalar_one() or 0)

    apps_status_stmt = (
        select(job_applications_table.c.status, func.count(job_applications_table.c.id).label("cnt"))
        .where(
            job_applications_table.c.user_id == worker_user_id,
            job_applications_table.c.created_at >= from_dt,
            job_applications_table.c.created_at < to_dt,
        )
        .group_by(job_applications_table.c.status)
    )
    apps_by_status: dict[str, int] = {
        str(r["status"]): int(r["cnt"]) for r in (await session.execute(apps_status_stmt)).mappings().all()
    }

    overview = AnalyticsOverviewOut(
        from_dt=from_dt,
        to_dt=to_dt,
        profile_views=int(pv_row["total"] or 0),
        profile_viewers_unique=int(pv_row["uniq"] or 0),
        resume_views=int(rv_row["total"] or 0),
        resume_viewers_unique=int(rv_row["uniq"] or 0),
        applications_sent=applications_sent,
        applications_by_status=apps_by_status,
    )

    ts_map: dict[date, AnalyticsTimeseriesPointOut] = {}

    def _get_point(d: date) -> AnalyticsTimeseriesPointOut:
        p = ts_map.get(d)
        if p is None:
            p = AnalyticsTimeseriesPointOut(day=d)
            ts_map[d] = p
        return p

    pv_ts_stmt = (
        select(
            func.date_trunc("day", analytics_events_table.c.occurred_at).label("d"),
            func.count(analytics_events_table.c.id).label("cnt"),
        )
        .where(
            analytics_events_table.c.event_type == AnalyticsEventType.profile_view.value,
            analytics_events_table.c.target_user_id == worker_user_id,
            analytics_events_table.c.occurred_at >= from_dt,
            analytics_events_table.c.occurred_at < to_dt,
        )
        .group_by("d")
        .order_by("d")
    )
    for r in (await session.execute(pv_ts_stmt)).mappings().all():
        d = r["d"].date() if isinstance(r["d"], datetime) else r["d"]
        _get_point(d).profile_views = int(r["cnt"])

    if resume_ids:
        rv_ts_stmt = (
            select(
                func.date_trunc("day", analytics_events_table.c.occurred_at).label("d"),
                func.count(analytics_events_table.c.id).label("cnt"),
            )
            .where(
                analytics_events_table.c.event_type == AnalyticsEventType.resume_view.value,
                analytics_events_table.c.target_resume_id.in_(resume_ids),
                analytics_events_table.c.occurred_at >= from_dt,
                analytics_events_table.c.occurred_at < to_dt,
            )
            .group_by("d")
            .order_by("d")
        )
        for r in (await session.execute(rv_ts_stmt)).mappings().all():
            d = r["d"].date() if isinstance(r["d"], datetime) else r["d"]
            _get_point(d).resume_views = int(r["cnt"])

    apps_ts_stmt = (
        select(
            func.date_trunc("day", job_applications_table.c.created_at).label("d"),
            func.count(job_applications_table.c.id).label("cnt"),
        )
        .where(
            job_applications_table.c.user_id == worker_user_id,
            job_applications_table.c.created_at >= from_dt,
            job_applications_table.c.created_at < to_dt,
        )
        .group_by("d")
        .order_by("d")
    )
    for r in (await session.execute(apps_ts_stmt)).mappings().all():
        d = r["d"].date() if isinstance(r["d"], datetime) else r["d"]
        _get_point(d).applications_sent = int(r["cnt"])

    all_days: list[AnalyticsTimeseriesPointOut] = []
    cursor = from_dt.date()
    end_day = (to_dt - timedelta(seconds=1)).date()
    while cursor <= end_day:
        all_days.append(ts_map.get(cursor) or AnalyticsTimeseriesPointOut(day=cursor))
        cursor = cursor + timedelta(days=1)

    apps_viewed = int(apps_by_status.get("viewed", 0))
    funnel = [
        AnalyticsFunnelStepOut(step="profile_views", count=overview.profile_views),
        AnalyticsFunnelStepOut(step="resume_views", count=overview.resume_views),
        AnalyticsFunnelStepOut(step="applications_sent", count=overview.applications_sent),
        AnalyticsFunnelStepOut(step="applications_viewed", count=apps_viewed),
    ]

    apps_stmt = (
        select(
            job_applications_table.c.id,
            job_applications_table.c.vacancy_id,
            job_applications_table.c.status,
            job_applications_table.c.created_at,
            job_applications_table.c.updated_at,
            vacancies_table.c.title.label("vacancy_title"),
            vacancies_table.c.company_id.label("company_id"),
        )
        .select_from(job_applications_table.join(vacancies_table, vacancies_table.c.id == job_applications_table.c.vacancy_id))
        .where(
            job_applications_table.c.user_id == worker_user_id,
            job_applications_table.c.created_at >= from_dt,
            job_applications_table.c.created_at < to_dt,
        )
        .order_by(job_applications_table.c.created_at.desc(), job_applications_table.c.id.desc())
        .limit(200)
    )
    apps_rows = (await session.execute(apps_stmt)).mappings().all()
    applications = [
        AnalyticsApplicationRowOut(
            id=int(r["id"]),
            vacancy_id=int(r["vacancy_id"]),
            vacancy_title=r.get("vacancy_title"),
            company_id=r.get("company_id"),
            status=str(r["status"]),
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )
        for r in apps_rows
    ]

    return AnalyticsDashboardOut(
        overview=overview,
        timeseries=all_days,
        funnel=funnel,
        applications=applications,
    )
