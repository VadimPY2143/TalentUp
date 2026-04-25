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
        return UserProfileResponse(**row)

    async def create_profile(
        self,
        session: AsyncSession,
        user_id: int,
        payload: UserProfileCreate,
    ) -> UserProfileResponse:
        exists = await self.repository.get_by_user_id(session=session, user_id=user_id)
        if exists:
            raise HTTPException(status_code=409, detail="Profile already exists")

        values = payload.model_dump(exclude_none=True)
        row = await self.repository.create(session=session, user_id=user_id, values=values)
        await session.commit()
        return UserProfileResponse(**row)

    async def upsert_profile(
        self,
        session: AsyncSession,
        user_id: int,
        payload: UserProfileUpdate,
    ) -> UserProfileResponse:
        values = payload.model_dump(exclude_unset=True)
        if not values:
            raise HTTPException(status_code=400, detail="No fields to update")

        existing = await self.repository.get_by_user_id(session=session, user_id=user_id)
        if existing:
            row = await self.repository.update_by_user_id(
                session=session,
                user_id=user_id,
                values=values,
            )
            if not row:
                raise HTTPException(status_code=404, detail="Profile not found")
        else:
            row = await self.repository.create(session=session, user_id=user_id, values=values)

        await session.commit()
        return UserProfileResponse(**row)

    async def delete_profile(self, session: AsyncSession, user_id: int) -> None:
        deleted = await self.repository.delete_by_user_id(session=session, user_id=user_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Profile not found")
        await session.commit()
