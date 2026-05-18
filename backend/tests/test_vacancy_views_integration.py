import sys
import os
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

sys.path.append(str(Path(__file__).resolve().parents[1]))

# Docker compose defaults for host execution.
# In container execution, compose environment variables override these defaults.
os.environ.setdefault("POSTGRES_DB", "talentup")
os.environ.setdefault("POSTGRES_USER", "talentup")
os.environ.setdefault("POSTGRES_PASSWORD", "talentup")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5433")

from database import (
    DATABASE_URL,
    companies_table,
    get_session,
    job_applications_table,
    users_table,
    vacancies_table,
)
from main import app
from users.auth import get_current_user

pytestmark = pytest.mark.asyncio(loop_scope="session")
test_engine = create_async_engine(DATABASE_URL, poolclass=NullPool, pool_pre_ping=True)
integration_session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=test_engine,
    expire_on_commit=False,
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _dispose_test_engine():
    yield
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db_ctx() -> dict[str, list[int]]:
    created: dict[str, list[int]] = {
        "job_applications": [],
        "vacancies": [],
        "companies": [],
        "users": [],
    }
    yield created

    async with integration_session_factory() as session:
        if created["job_applications"]:
            await session.execute(
                delete(job_applications_table).where(job_applications_table.c.id.in_(created["job_applications"]))
            )
        if created["vacancies"]:
            await session.execute(delete(vacancies_table).where(vacancies_table.c.id.in_(created["vacancies"])))
        if created["companies"]:
            await session.execute(delete(companies_table).where(companies_table.c.id.in_(created["companies"])))
        if created["users"]:
            await session.execute(delete(users_table).where(users_table.c.id.in_(created["users"])))
        await session.commit()


@pytest_asyncio.fixture
async def test_app(db_ctx: dict[str, list[int]]):
    async def override_get_session():
        async with integration_session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(test_app):
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as test_client:
        yield test_client


def _set_current_user(test_app, user: dict[str, Any]) -> None:
    async def override_current_user() -> dict[str, Any]:
        return user

    test_app.dependency_overrides[get_current_user] = override_current_user


async def _create_user(
    created: dict[str, list[int]],
    *,
    role: str,
    prefix: str,
) -> int:
    token = uuid4().hex[:8]
    stmt = (
        insert(users_table)
        .values(
            username=f"{prefix}_{token}",
            email=f"{prefix}_{token}@example.com",
            password="hashed-password",
            role=role,
        )
        .returning(users_table.c.id)
    )
    async with integration_session_factory() as session:
        user_id = (await session.execute(stmt)).scalar_one()
        await session.commit()
    created["users"].append(user_id)
    return user_id


async def _create_company(
    created: dict[str, list[int]],
    *,
    user_id: int,
    name: str,
) -> int:
    stmt = (
        insert(companies_table)
        .values(
            user_id=user_id,
            name=name,
        )
        .returning(companies_table.c.id)
    )
    async with integration_session_factory() as session:
        company_id = (await session.execute(stmt)).scalar_one()
        await session.commit()
    created["companies"].append(company_id)
    return company_id


async def _create_vacancy(
    created: dict[str, list[int]],
    *,
    company_id: int,
    created_by_user_id: int,
    title: str,
    is_active: bool = True,
) -> int:
    stmt = (
        insert(vacancies_table)
        .values(
            company_id=company_id,
            created_by_user_id=created_by_user_id,
            title=title,
            description="Detailed vacancy description for integration test.",
            is_active=is_active,
            location="Kyiv",
        )
        .returning(vacancies_table.c.id)
    )
    async with integration_session_factory() as session:
        vacancy_id = (await session.execute(stmt)).scalar_one()
        await session.commit()
    created["vacancies"].append(vacancy_id)
    return vacancy_id


async def test_create_and_get_vacancy_integration(client, test_app, db_ctx) -> None:
    created = db_ctx
    employer_id = await _create_user(created, role="employer", prefix="it_emp")
    company_id = await _create_company(created, user_id=employer_id, name="IT Company 1")
    _set_current_user(test_app, {"id": employer_id, "role": "employer"})

    payload = {
        "title": "Python Backend Engineer",
        "description": "We need an experienced Python engineer for API development.",
        "location": "Kyiv",
        "salary_min": 2000,
        "salary_max": 3500,
        "salary_currency": "USD",
        "is_active": True,
    }

    create_resp = await client.post(f"/companies/{company_id}/vacancies", json=payload)
    assert create_resp.status_code == 201
    body = create_resp.json()
    created["vacancies"].append(body["id"])
    assert body["company_id"] == company_id
    assert body["created_by_user_id"] == employer_id
    assert body["title"] == payload["title"]

    async with integration_session_factory() as session:
        db_row = (
            await session.execute(select(vacancies_table).where(vacancies_table.c.id == body["id"]))
        ).mappings().one()
    assert db_row["title"] == payload["title"]
    assert db_row["salary_min"] == payload["salary_min"]

    get_resp = await client.get(f"/companies/{company_id}/vacancies/{body['id']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == body["id"]


async def test_worker_sees_only_active_company_vacancies(client, test_app, db_ctx) -> None:
    created = db_ctx
    employer_id = await _create_user(created, role="employer", prefix="it_emp")
    worker_id = await _create_user(created, role="worker", prefix="it_worker")
    company_id = await _create_company(created, user_id=employer_id, name="IT Company 2")
    active_id = await _create_vacancy(
        created,
        company_id=company_id,
        created_by_user_id=employer_id,
        title="Active Vacancy",
        is_active=True,
    )
    await _create_vacancy(
        created,
        company_id=company_id,
        created_by_user_id=employer_id,
        title="Inactive Vacancy",
        is_active=False,
    )
    _set_current_user(test_app, {"id": worker_id, "role": "worker"})

    resp = await client.get(f"/companies/{company_id}/vacancies")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == active_id
    assert data[0]["is_active"] is True


async def test_update_vacancy_integration(client, test_app, db_ctx) -> None:
    created = db_ctx
    employer_id = await _create_user(created, role="employer", prefix="it_emp")
    company_id = await _create_company(created, user_id=employer_id, name="IT Company 3")
    vacancy_id = await _create_vacancy(
        created,
        company_id=company_id,
        created_by_user_id=employer_id,
        title="Old Title",
    )
    _set_current_user(test_app, {"id": employer_id, "role": "employer"})

    update_payload = {
        "title": "Senior Python Engineer",
        "is_active": False,
        "salary_min": 2500,
        "salary_max": 4200,
    }
    resp = await client.put(f"/companies/{company_id}/vacancies/{vacancy_id}", json=update_payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Senior Python Engineer"
    assert body["is_active"] is False

    async with integration_session_factory() as session:
        db_row = (
            await session.execute(select(vacancies_table).where(vacancies_table.c.id == vacancy_id))
        ).mappings().one()
    assert db_row["title"] == "Senior Python Engineer"
    assert db_row["salary_max"] == 4200


async def test_delete_vacancy_archives_when_has_applications(client, test_app, db_ctx) -> None:
    created = db_ctx
    employer_id = await _create_user(created, role="employer", prefix="it_emp")
    worker_id = await _create_user(created, role="worker", prefix="it_worker")
    company_id = await _create_company(created, user_id=employer_id, name="IT Company 4")
    vacancy_id = await _create_vacancy(
        created,
        company_id=company_id,
        created_by_user_id=employer_id,
        title="Vacancy To Archive",
    )
    _set_current_user(test_app, {"id": employer_id, "role": "employer"})

    async with integration_session_factory() as session:
        application_id = (
            await session.execute(
                insert(job_applications_table)
                .values(
                    user_id=worker_id,
                    vacancy_id=vacancy_id,
                    resume_id=None,
                    cover_letter="Please review my profile.",
                )
                .returning(job_applications_table.c.id)
            )
        ).scalar_one()
        await session.commit()
    created["job_applications"].append(application_id)

    delete_resp = await client.delete(f"/companies/{company_id}/vacancies/{vacancy_id}")
    assert delete_resp.status_code == 200
    assert delete_resp.json()["status"] == "archived"

    async with integration_session_factory() as session:
        db_row = (
            await session.execute(select(vacancies_table).where(vacancies_table.c.id == vacancy_id))
        ).mappings().one()
    assert db_row["is_active"] is False
