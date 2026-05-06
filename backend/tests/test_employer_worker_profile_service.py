import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.append(str(Path(__file__).resolve().parents[1]))

from employer.worker_profile.services import WorkerProfileService
from users.define_roles import require_roles


class _RepositoryStub:
    def __init__(
        self,
        *,
        worker_user: dict | None,
        profile: dict | None,
        user_languages: list[dict],
        user_links: list[dict],
        active_resumes: list[dict],
    ) -> None:
        self.worker_user = worker_user
        self.profile = profile
        self.user_languages = user_languages
        self.user_links = user_links
        self.active_resumes = active_resumes

    async def get_worker_user(self, session: object, user_id: int) -> dict | None:
        del session, user_id
        return self.worker_user

    async def get_user_profile(self, session: object, user_id: int) -> dict | None:
        del session, user_id
        return self.profile

    async def get_user_languages(self, session: object, user_id: int) -> list[dict]:
        del session, user_id
        return self.user_languages

    async def get_user_links(self, session: object, user_id: int) -> list[dict]:
        del session, user_id
        return self.user_links

    async def get_active_resumes(self, session: object, user_id: int) -> list[dict]:
        del session, user_id
        return self.active_resumes


@pytest.mark.asyncio
async def test_get_worker_public_profile_returns_profile_and_active_resumes() -> None:
    repository = _RepositoryStub(
        worker_user={"id": 12, "username": "worker_one", "role": "worker"},
        profile={
            "city": "Kyiv",
            "education": "KPI",
            "bio": "Python backend engineer",
            "phone": "+3800000000",
            "languages": ["English"],
            "links": ["https://example.com"],
        },
        user_languages=[
            {
                "id": 1,
                "language_id": 4,
                "language_name": "English",
                "proficiency_level": "B2",
            }
        ],
        user_links=[
            {
                "id": 2,
                "title": "LinkedIn",
                "url": "https://linkedin.com/in/worker",
            }
        ],
        active_resumes=[
            {
                "id": 101,
                "title": "Backend Python",
                "summary": "FastAPI, PostgreSQL",
                "desired_role": "Backend Developer",
                "employment_type": ["Remote"],
                "location": "Kyiv",
                "salary_min": 2000,
                "salary_max": 3000,
                "salary_currency": "USD",
                "years_experience": 4,
                "is_active": True,
                "pdf_file_path": "uploads/resumes/12/resume_101.pdf",
                "pdf_original_name": "resume.pdf",
                "pdf_size": 1234,
                "pdf_uploaded_at": None,
                "updated_at": "2026-05-01T10:00:00",
            }
        ],
    )
    service = WorkerProfileService(repository=repository)

    payload = await service.get_worker_public_profile(session=object(), worker_user_id=12)

    assert payload.user_id == 12
    assert payload.username == "worker_one"
    assert payload.city == "Kyiv"
    assert len(payload.user_languages) == 1
    assert len(payload.user_links) == 1
    assert len(payload.active_resumes) == 1
    assert payload.active_resumes[0].id == 101


@pytest.mark.asyncio
async def test_get_worker_public_profile_returns_empty_profile_when_user_profile_missing() -> None:
    repository = _RepositoryStub(
        worker_user={"id": 18, "username": "worker_two", "role": "worker"},
        profile=None,
        user_languages=[],
        user_links=[],
        active_resumes=[],
    )
    service = WorkerProfileService(repository=repository)

    payload = await service.get_worker_public_profile(session=object(), worker_user_id=18)

    assert payload.user_id == 18
    assert payload.username == "worker_two"
    assert payload.city is None
    assert payload.education is None
    assert payload.bio is None
    assert payload.phone is None
    assert payload.active_resumes == []


@pytest.mark.asyncio
async def test_get_worker_public_profile_raises_404_for_unknown_user() -> None:
    repository = _RepositoryStub(
        worker_user=None,
        profile=None,
        user_languages=[],
        user_links=[],
        active_resumes=[],
    )
    service = WorkerProfileService(repository=repository)

    with pytest.raises(HTTPException, match="Worker not found") as exc_info:
        await service.get_worker_public_profile(session=object(), worker_user_id=999)

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_get_worker_public_profile_raises_404_for_non_worker_role() -> None:
    repository = _RepositoryStub(
        worker_user={"id": 21, "username": "employer_like", "role": "employer"},
        profile=None,
        user_languages=[],
        user_links=[],
        active_resumes=[],
    )
    service = WorkerProfileService(repository=repository)

    with pytest.raises(HTTPException, match="Worker not found") as exc_info:
        await service.get_worker_public_profile(session=object(), worker_user_id=21)

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_require_roles_rejects_worker_for_employer_only_endpoint() -> None:
    checker = require_roles(["employer"])

    with pytest.raises(HTTPException, match="Insufficient permissions") as exc_info:
        await checker(user={"id": 1, "role": "worker"})

    assert exc_info.value.status_code == 403
