from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from .models import EmployerWorkerProfileResponse
from .repositories import WorkerProfileRepository


class WorkerProfileService:
    def __init__(self, repository: WorkerProfileRepository):
        self.repository = repository

    async def get_worker_public_profile(
        self,
        session: AsyncSession,
        worker_user_id: int,
    ) -> EmployerWorkerProfileResponse:
        worker_user = await self.repository.get_worker_user(session=session, user_id=worker_user_id)
        if not worker_user or worker_user.get("role") != "worker":
            raise HTTPException(status_code=404, detail="Worker not found")

        profile = await self.repository.get_user_profile(session=session, user_id=worker_user_id)
        user_languages = await self.repository.get_user_languages(session=session, user_id=worker_user_id)
        user_links = await self.repository.get_user_links(session=session, user_id=worker_user_id)
        active_resumes = await self.repository.get_active_resumes(session=session, user_id=worker_user_id)

        return EmployerWorkerProfileResponse(
            user_id=int(worker_user["id"]),
            username=str(worker_user["username"]),
            city=profile.get("city") if profile else None,
            education=profile.get("education") if profile else None,
            bio=profile.get("bio") if profile else None,
            phone=profile.get("phone") if profile else None,
            languages=profile.get("languages") if profile else None,
            links=profile.get("links") if profile else None,
            user_languages=user_languages,
            user_links=user_links,
            active_resumes=active_resumes,
        )
