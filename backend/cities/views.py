from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from cities.models import CityOption
from cities.service import CityService
from database import get_session

router = APIRouter(prefix="/cities", tags=["cities"])


@router.get("", response_model=list[CityOption])
async def get_cities(
    query: str | None = Query(None, max_length=255),
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> list[CityOption]:
    service = CityService(session=session)
    cities = await service.list_options(query=query, limit=limit)
    return [CityOption.model_validate(city) for city in cities]
