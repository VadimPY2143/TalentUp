from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    get_refresh_token_expiry,
    hash_refresh_token,
    verify_password,
)
from .models import TokenPair, UserProfileCreate, UserProfileResponse, UserProfileUpdate
from .repositories import UserProfileRepository, UserSecurityRepository


class UserProfileService:
    def __init__(self, repository: UserProfileRepository):
        self.repository = repository

    async def _normalize_user_languages_payload(
        self,
        session: AsyncSession,
        raw_languages: list[dict] | None,
    ) -> list[dict[str, str | int]]:
        if raw_languages is None:
            return []

        names_to_resolve: list[str] = []
        for item in raw_languages:
            if not isinstance(item, dict):
                continue
            language_id = item.get("language_id")
            if language_id in (None, ""):
                name = str(item.get("name", "")).strip()
                if name:
                    names_to_resolve.append(name)

        resolved_by_name = await self.repository.get_language_ids_by_names(session=session, names=names_to_resolve)

        normalized: list[dict[str, str | int]] = []
        missing_names: list[str] = []
        for item in raw_languages:
            if not isinstance(item, dict):
                continue

            proficiency_level = str(item.get("proficiency_level", "")).strip()
            if not proficiency_level:
                raise HTTPException(status_code=400, detail="Language proficiency_level is required")

            language_id_raw = item.get("language_id")
            language_id: int | None = None
            if language_id_raw not in (None, ""):
                try:
                    language_id = int(language_id_raw)
                except (TypeError, ValueError):
                    raise HTTPException(status_code=400, detail="language_id must be integer") from None
            else:
                name = str(item.get("name", "")).strip()
                if not name:
                    raise HTTPException(status_code=400, detail="Language name is required")
                language_id = resolved_by_name.get(name.lower())
                if language_id is None:
                    missing_names.append(name)
                    continue

            normalized.append(
                {
                    "language_id": language_id,
                    "proficiency_level": proficiency_level,
                }
            )

        if missing_names:
            missing_joined = ", ".join(sorted(set(missing_names)))
            raise HTTPException(
                status_code=400,
                detail=f"Unknown languages: {missing_joined}",
            )

        return normalized

    async def get_profile(self, session: AsyncSession, user_id: int) -> UserProfileResponse:
        row = await self.repository.get_by_user_id(session=session, user_id=user_id)
        if not row:
            raise HTTPException(status_code=404, detail="Profile not found")
        user_languages = await self.repository.get_user_languages(session=session, user_id=user_id)
        user_links = await self.repository.get_user_links(session=session, user_id=user_id)
        return UserProfileResponse(**row, user_languages=user_languages, user_links=user_links)

    async def create_profile(
        self,
        session: AsyncSession,
        user_id: int,
        payload: UserProfileCreate,
    ) -> UserProfileResponse:
        exists = await self.repository.get_by_user_id(session=session, user_id=user_id)
        if exists:
            raise HTTPException(status_code=409, detail="Profile already exists")

        values = payload.model_dump(exclude_none=True, exclude={"user_languages", "user_links"})
        row = await self.repository.create(session=session, user_id=user_id, values=values)
        if payload.user_languages:
            normalized_languages = await self._normalize_user_languages_payload(
                session=session,
                raw_languages=payload.user_languages,
            )
            await self.repository.upsert_user_languages(
                session=session,
                user_id=user_id,
                languages=normalized_languages,
            )
        if payload.user_links:
            await self.repository.upsert_user_links(
                session=session,
                user_id=user_id,
                links=payload.user_links,
            )
        await session.commit()

        user_languages = await self.repository.get_user_languages(session=session, user_id=user_id)
        user_links = await self.repository.get_user_links(session=session, user_id=user_id)
        return UserProfileResponse(**row, user_languages=user_languages, user_links=user_links)

    async def upsert_profile(
        self,
        session: AsyncSession,
        user_id: int,
        payload: UserProfileUpdate,
    ) -> UserProfileResponse:
        values = payload.model_dump(exclude_unset=True, exclude={"user_languages", "user_links"})
        if not values and not hasattr(payload, "user_languages") and not hasattr(payload, "user_links"):
            raise HTTPException(status_code=400, detail="No fields to update")

        existing = await self.repository.get_by_user_id(session=session, user_id=user_id)
        if existing:
            if values:
                row = await self.repository.update_by_user_id(
                    session=session,
                    user_id=user_id,
                    values=values,
                )
                if not row:
                    raise HTTPException(status_code=404, detail="Profile not found")
            else:
                row = existing
        else:
            if values:
                row = await self.repository.create(session=session, user_id=user_id, values=values)
            else:
                row = {"id": 0, "user_id": user_id}

        if payload.user_languages is not None:
            normalized_languages = await self._normalize_user_languages_payload(
                session=session,
                raw_languages=payload.user_languages,
            )
            await self.repository.upsert_user_languages(
                session=session,
                user_id=user_id,
                languages=normalized_languages,
            )
        if payload.user_links is not None:
            await self.repository.upsert_user_links(
                session=session,
                user_id=user_id,
                links=payload.user_links,
            )
        await session.commit()

        user_languages = await self.repository.get_user_languages(session=session, user_id=user_id)
        user_links = await self.repository.get_user_links(session=session, user_id=user_id)
        return UserProfileResponse(**row, user_languages=user_languages, user_links=user_links)

    async def delete_profile(self, session: AsyncSession, user_id: int) -> None:
        deleted = await self.repository.delete_by_user_id(session=session, user_id=user_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Profile not found")
        await session.commit()


class UserSecurityService:
    def __init__(self, repository: UserSecurityRepository):
        self.repository = repository

    async def change_password(
        self,
        session: AsyncSession,
        current_user: dict,
        current_password: str,
        new_password: str,
    ) -> TokenPair:
        if not verify_password(current_password, current_user["password"]):
            raise HTTPException(status_code=401, detail="Current password is incorrect")

        if current_password == new_password:
            raise HTTPException(status_code=400, detail="New password must be different")

        password_hash = get_password_hash(new_password)
        refresh_token = create_refresh_token()

        await self.repository.update_password_hash(
            session=session,
            user_id=current_user["id"],
            password_hash=password_hash,
        )
        await self.repository.revoke_refresh_tokens(
            session=session,
            user_id=current_user["id"],
        )
        await self.repository.create_refresh_token(
            session=session,
            user_id=current_user["id"],
            token_hash=hash_refresh_token(refresh_token),
            expires_at=get_refresh_token_expiry(),
        )
        await session.commit()

        access_token = create_access_token(
            data={"sub": current_user["email"], "role": current_user["role"]},
        )
        return TokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
        )
