from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session

from .auth import get_current_user
from .models import UserProfileCreate, UserProfileResponse, UserProfileUpdate
from .repositories import UserProfileRepository
from .services import UserProfileService

router = APIRouter(tags=["users_profile"])

profile_service = UserProfileService(repository=UserProfileRepository())


@router.get("/user/profile", response_model=UserProfileResponse)
async def get_user_profile(
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> UserProfileResponse:
    return await profile_service.get_profile(session=session, user_id=current_user["id"])


@router.post(
    "/user/profile",
    response_model=UserProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_user_profile(
    payload: UserProfileCreate,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> UserProfileResponse:
    return await profile_service.create_profile(
        session=session,
        user_id=current_user["id"],
        payload=payload,
    )


@router.put("/user/profile", response_model=UserProfileResponse)
async def upsert_user_profile(
    payload: UserProfileUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> UserProfileResponse:
    return await profile_service.upsert_profile(
        session=session,
        user_id=current_user["id"],
        payload=payload,
    )


@router.patch("/user/profile", response_model=UserProfileResponse)
async def patch_user_profile(
    payload: UserProfileUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> UserProfileResponse:
    return await profile_service.upsert_profile(
        session=session,
        user_id=current_user["id"],
        payload=payload,
    )


@router.delete("/user/profile", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_profile(
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> Response:
    await profile_service.delete_profile(session=session, user_id=current_user["id"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)
