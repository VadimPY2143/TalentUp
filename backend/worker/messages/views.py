from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from users.define_roles import require_roles

from .models import (
    VacancySubscriptionCreateIn,
    VacancySubscriptionOut,
    VacancySubscriptionSetActiveIn,
    VacancySubscriptionUpdateIn,
)
from .repositories import VacancySubscriptionRepository
from .services import VacancySubscriptionService

router = APIRouter(prefix="/worker/vacancy-subscriptions", tags=["vacancy_subscriptions"])


def _build_service() -> VacancySubscriptionService:
    return VacancySubscriptionService(repository=VacancySubscriptionRepository())


@router.post("", response_model=VacancySubscriptionOut, status_code=status.HTTP_201_CREATED)
async def create_vacancy_subscription(
    payload: VacancySubscriptionCreateIn,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> VacancySubscriptionOut:
    service = _build_service()
    return await service.create(session=session, current_user=current_user, payload=payload)


@router.get("", response_model=list[VacancySubscriptionOut])
async def list_vacancy_subscriptions(
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> list[VacancySubscriptionOut]:
    service = _build_service()
    return await service.list_by_user(session=session, user_id=current_user["id"])


@router.get("/{subscription_id}", response_model=VacancySubscriptionOut)
async def get_vacancy_subscription(
    subscription_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> VacancySubscriptionOut:
    service = _build_service()
    return await service.get_owned(
        session=session,
        subscription_id=subscription_id,
        user_id=current_user["id"],
    )


@router.put("/{subscription_id}", response_model=VacancySubscriptionOut)
async def update_vacancy_subscription(
    subscription_id: int,
    payload: VacancySubscriptionUpdateIn,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> VacancySubscriptionOut:
    service = _build_service()
    return await service.update(
        session=session,
        subscription_id=subscription_id,
        user_id=current_user["id"],
        payload=payload,
    )


@router.patch("/{subscription_id}/active", response_model=VacancySubscriptionOut)
async def set_vacancy_subscription_active(
    subscription_id: int,
    payload: VacancySubscriptionSetActiveIn,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> VacancySubscriptionOut:
    service = _build_service()
    return await service.update(
        session=session,
        subscription_id=subscription_id,
        user_id=current_user["id"],
        payload=VacancySubscriptionUpdateIn(is_active=payload.is_active),
    )


@router.delete("/{subscription_id}")
async def delete_vacancy_subscription(
    subscription_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> dict[str, str]:
    service = _build_service()
    await service.delete(
        session=session,
        subscription_id=subscription_id,
        user_id=current_user["id"],
    )
    return {"status": "ok"}
