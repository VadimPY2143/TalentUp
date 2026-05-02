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
