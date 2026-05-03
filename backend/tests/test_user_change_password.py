import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.append(str(Path(__file__).resolve().parents[1]))

from users.auth import get_password_hash
from users.services import UserSecurityService


class _SessionStub:
    def __init__(self) -> None:
        self.commit_calls = 0

    async def commit(self) -> None:
        self.commit_calls += 1


class _RepositoryStub:
    def __init__(self) -> None:
        self.updated_password_hash: str | None = None
        self.updated_user_id: int | None = None
        self.revoked_for_user_id: int | None = None
        self.created_refresh_token: dict[str, object] | None = None

    async def update_password_hash(
        self,
        *,
        session: object,
        user_id: int,
        password_hash: str,
    ) -> None:
        del session
        self.updated_password_hash = password_hash
        self.updated_user_id = user_id

    async def revoke_refresh_tokens(self, *, session: object, user_id: int) -> None:
        del session
        self.revoked_for_user_id = user_id

    async def create_refresh_token(
        self,
        *,
        session: object,
        user_id: int,
        token_hash: str,
        expires_at: object,
    ) -> None:
        del session
        self.created_refresh_token = {
            "user_id": user_id,
            "token_hash": token_hash,
            "expires_at": expires_at,
        }


@pytest.mark.asyncio
async def test_change_password_updates_hash_and_rotates_refresh_token() -> None:
    repository = _RepositoryStub()
    service = UserSecurityService(repository=repository)
    session = _SessionStub()
    current_user = {
        "id": 7,
        "email": "worker@example.com",
        "role": "worker",
        "password": get_password_hash("current-password"),
    }

    token_pair = await service.change_password(
        session=session,
        current_user=current_user,
        current_password="current-password",
        new_password="new-password-123",
    )

    assert repository.updated_password_hash is not None
    assert repository.updated_password_hash != current_user["password"]
    assert repository.updated_password_hash != "new-password-123"
    assert repository.revoked_for_user_id == 7
    assert repository.created_refresh_token is not None
    assert repository.created_refresh_token["user_id"] == 7
    assert repository.created_refresh_token["token_hash"] != token_pair.refresh_token
    assert token_pair.access_token
    assert token_pair.refresh_token
    assert token_pair.token_type == "bearer"
    assert session.commit_calls == 1


@pytest.mark.asyncio
async def test_change_password_rejects_invalid_current_password() -> None:
    repository = _RepositoryStub()
    service = UserSecurityService(repository=repository)
    session = _SessionStub()
    current_user = {
        "id": 7,
        "email": "worker@example.com",
        "role": "worker",
        "password": get_password_hash("current-password"),
    }

    with pytest.raises(HTTPException, match="Current password is incorrect") as exc_info:
        await service.change_password(
            session=session,
            current_user=current_user,
            current_password="wrong-password",
            new_password="new-password-123",
        )

    assert exc_info.value.status_code == 401
    assert repository.updated_password_hash is None
    assert repository.created_refresh_token is None
    assert session.commit_calls == 0
