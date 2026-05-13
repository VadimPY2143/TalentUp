import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi import Response, status

sys.path.append(str(Path(__file__).resolve().parents[1]))

from users.models import UserProfileCreate, UserProfileResponse, UserProfileUpdate
from users.views import (
    create_user_profile,
    delete_user_profile,
    get_user_profile,
    patch_user_profile,
    upsert_user_profile,
)
from users import views


def _profile_response(*, user_id: int) -> UserProfileResponse:
    now = datetime.utcnow()
    return UserProfileResponse(
        id=1,
        user_id=user_id,
        city="Kyiv",
        education="BS",
        bio="Backend engineer",
        birth_date=None,
        phone=None,
        languages=["English"],
        links=["https://example.com"],
        user_languages=[],
        user_links=[],
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_get_user_profile_uses_current_user_id(monkeypatch: pytest.MonkeyPatch) -> None:
    expected = _profile_response(user_id=11)
    get_profile_mock = AsyncMock(return_value=expected)
    monkeypatch.setattr(views.profile_service, "get_profile", get_profile_mock)
    session = object()

    result = await get_user_profile(session=session, current_user={"id": 11})

    assert result == expected
    get_profile_mock.assert_awaited_once_with(session=session, user_id=11)


@pytest.mark.asyncio
async def test_create_user_profile_passes_payload_to_service(monkeypatch: pytest.MonkeyPatch) -> None:
    expected = _profile_response(user_id=25)
    create_profile_mock = AsyncMock(return_value=expected)
    monkeypatch.setattr(views.profile_service, "create_profile", create_profile_mock)
    session = object()
    payload = UserProfileCreate(city="Lviv", bio="Python dev")

    result = await create_user_profile(payload=payload, session=session, current_user={"id": 25})

    assert result == expected
    create_profile_mock.assert_awaited_once_with(session=session, user_id=25, payload=payload)


@pytest.mark.asyncio
async def test_put_user_profile_calls_upsert_profile(monkeypatch: pytest.MonkeyPatch) -> None:
    expected = _profile_response(user_id=33)
    upsert_profile_mock = AsyncMock(return_value=expected)
    monkeypatch.setattr(views.profile_service, "upsert_profile", upsert_profile_mock)
    session = object()
    payload = UserProfileUpdate(city="Dnipro")

    result = await upsert_user_profile(payload=payload, session=session, current_user={"id": 33})

    assert result == expected
    upsert_profile_mock.assert_awaited_once_with(session=session, user_id=33, payload=payload)


@pytest.mark.asyncio
async def test_patch_user_profile_calls_upsert_profile(monkeypatch: pytest.MonkeyPatch) -> None:
    expected = _profile_response(user_id=44)
    upsert_profile_mock = AsyncMock(return_value=expected)
    monkeypatch.setattr(views.profile_service, "upsert_profile", upsert_profile_mock)
    session = object()
    payload = UserProfileUpdate(bio="Updated bio")

    result = await patch_user_profile(payload=payload, session=session, current_user={"id": 44})

    assert result == expected
    upsert_profile_mock.assert_awaited_once_with(session=session, user_id=44, payload=payload)


@pytest.mark.asyncio
async def test_delete_user_profile_calls_service_and_returns_no_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    delete_profile_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(views.profile_service, "delete_profile", delete_profile_mock)
    session = object()

    result = await delete_user_profile(session=session, current_user={"id": 52})

    assert isinstance(result, Response)
    assert result.status_code == status.HTTP_204_NO_CONTENT
    delete_profile_mock.assert_awaited_once_with(session=session, user_id=52)
