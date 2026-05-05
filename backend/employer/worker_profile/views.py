from fastapi import APIRouter, Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from users.define_roles import require_roles

from .models import EmployerWorkerProfileResponse
from .repositories import WorkerProfileRepository
from .services import WorkerProfileService

router = APIRouter(tags=["employer_worker_profile"])
service = WorkerProfileService(repository=WorkerProfileRepository())


@router.get("/employer/workers/{worker_user_id}/profile", response_model=EmployerWorkerProfileResponse)
async def get_worker_profile_for_employer(
    worker_user_id: int = Path(..., ge=1),
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> EmployerWorkerProfileResponse:
    return await service.get_worker_public_profile(
        session=session,
        worker_user_id=worker_user_id,
    )
