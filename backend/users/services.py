from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from .models import UserProfileCreate, UserProfileResponse, UserProfileUpdate
from .repositories import UserProfileRepository


class UserProfileService:
    def __init__(self, repository: UserProfileRepository):
        self.repository = repository

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
        await session.commit()
        
        # Handle user languages if provided
        if hasattr(payload, "user_languages") and payload.user_languages:
            await self.repository.upsert_user_languages(
                session=session,
                user_id=user_id,
                languages=payload.user_languages,
            )
        
        # Handle user links if provided
        if hasattr(payload, "user_links") and payload.user_links:
            await self.repository.upsert_user_links(
                session=session,
                user_id=user_id,
                links=payload.user_links,
            )
        
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

        await session.commit()
        
        # Handle user languages if provided
        if hasattr(payload, "user_languages") and payload.user_languages is not None:
            await self.repository.upsert_user_languages(
                session=session,
                user_id=user_id,
                languages=payload.user_languages,
            )
        
        # Handle user links if provided
        if hasattr(payload, "user_links") and payload.user_links is not None:
            await self.repository.upsert_user_links(
                session=session,
                user_id=user_id,
                links=payload.user_links,
            )
        
        user_languages = await self.repository.get_user_languages(session=session, user_id=user_id)
        user_links = await self.repository.get_user_links(session=session, user_id=user_id)
        return UserProfileResponse(**row, user_languages=user_languages, user_links=user_links)

    async def delete_profile(self, session: AsyncSession, user_id: int) -> None:
        deleted = await self.repository.delete_by_user_id(session=session, user_id=user_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Profile not found")
        await session.commit()
