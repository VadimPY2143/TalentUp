from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import delete, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from cities.service import CityService
from database import companies_table, get_session, vacancies_table
from users.define_roles import require_roles

from .ai_filling import generate_vacancy
from .models import Vacancy, VacancyAIFillRequest, VacancyResponse, VacancyUpdate

router = APIRouter(tags=["vacancies"])


async def _ensure_owned_company(
    company_id: int,
    session: AsyncSession,
    current_user: dict,
) -> None:
    stmt = select(companies_table.c.id).where(
        companies_table.c.id == company_id,
        companies_table.c.user_id == current_user["id"],
    )
    result = await session.execute(stmt)
    company = result.first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")


@router.get("/companies/{company_id}/vacancies", response_model=list[VacancyResponse])
async def list_company_vacancies(
    company_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer", "worker"])),
) -> list[VacancyResponse]:
    if current_user["role"] == "employer":
        await _ensure_owned_company(company_id=company_id, session=session, current_user=current_user)
        stmt = (
            select(vacancies_table)
            .where(vacancies_table.c.company_id == company_id)
            .order_by(vacancies_table.c.created_at.desc(), vacancies_table.c.id.desc())
        )
    else:
        company_stmt = select(companies_table.c.id).where(companies_table.c.id == company_id)
        company_exists = (await session.execute(company_stmt)).scalar_one_or_none()
        if company_exists is None:
            raise HTTPException(status_code=404, detail="Company not found")

        now_utc = datetime.now(timezone.utc)
        stmt = (
            select(vacancies_table)
            .where(vacancies_table.c.company_id == company_id)
            .where(vacancies_table.c.is_active.is_(True))
            .where(
                or_(
                    vacancies_table.c.expires_at.is_(None),
                    vacancies_table.c.expires_at > now_utc,
                )
            )
            .order_by(vacancies_table.c.created_at.desc(), vacancies_table.c.id.desc())
        )

    result = await session.execute(stmt)
    rows = result.mappings().all()
    return [VacancyResponse(**row) for row in rows]


@router.post(
    "/companies/{company_id}/vacancies/ai-fill",
    response_model=Vacancy,
)
async def fill_vacancy_with_ai(
    company_id: int,
    payload: VacancyAIFillRequest,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> Vacancy:
    await _ensure_owned_company(company_id=company_id, session=session, current_user=current_user)
    try:
        generated = await generate_vacancy(payload.description)
        return Vacancy.model_validate(generated)
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to parse AI vacancy response: {exc}") from exc


@router.post(
    "/companies/{company_id}/vacancies",
    response_model=VacancyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_vacancy(
    company_id: int,
    vacancy: Vacancy,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> VacancyResponse:
    await _ensure_owned_company(company_id=company_id, session=session, current_user=current_user)

    city_service = CityService(session=session)
    city = await city_service.resolve_city(city_id=vacancy.city_id, location=vacancy.location)
    if vacancy.city_id is not None and city is None:
        raise HTTPException(status_code=400, detail="City not found")

    values = vacancy.model_dump(exclude_none=True)
    values["city_id"] = city["id"] if city else None
    values["location"] = city["name_uk"] if city else vacancy.location

    stmt = (
        insert(vacancies_table)
        .values(
            company_id=company_id,
            created_by_user_id=current_user["id"],
            **values,
        )
        .returning(*vacancies_table.c)
    )
    result = await session.execute(stmt)
    await session.commit()
    row = result.mappings().one()
    return VacancyResponse(**row)


@router.get("/companies/{company_id}/vacancies/{vacancy_id}", response_model=VacancyResponse)
async def get_vacancy_by_id(
    company_id: int,
    vacancy_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> VacancyResponse:
    await _ensure_owned_company(company_id=company_id, session=session, current_user=current_user)

    stmt = select(vacancies_table).where(
        vacancies_table.c.id == vacancy_id,
        vacancies_table.c.company_id == company_id,
    )
    result = await session.execute(stmt)
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Vacancy not found")
    return VacancyResponse(**row)


@router.put("/companies/{company_id}/vacancies/{vacancy_id}", response_model=VacancyResponse)
async def update_vacancy_by_id(
    company_id: int,
    vacancy_id: int,
    payload: VacancyUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> VacancyResponse:
    await _ensure_owned_company(company_id=company_id, session=session, current_user=current_user)

    values = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not values:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "city_id" in values or "location" in values:
        city_service = CityService(session=session)
        city = await city_service.resolve_city(
            city_id=values.get("city_id"),
            location=values.get("location"),
        )
        if values.get("city_id") is not None and city is None:
            raise HTTPException(status_code=400, detail="City not found")
        values["city_id"] = city["id"] if city else None
        values["location"] = city["name_uk"] if city else values.get("location")

    stmt = (
        update(vacancies_table)
        .where(
            vacancies_table.c.id == vacancy_id,
            vacancies_table.c.company_id == company_id,
        )
        .values(**values)
        .returning(*vacancies_table.c)
    )
    result = await session.execute(stmt)
    await session.commit()
    row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    return VacancyResponse(**row)


@router.delete("/companies/{company_id}/vacancies/{vacancy_id}")
async def delete_vacancy_by_id(
    company_id: int,
    vacancy_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
):
    await _ensure_owned_company(company_id=company_id, session=session, current_user=current_user)

    stmt = (
        delete(vacancies_table)
        .where(
            vacancies_table.c.id == vacancy_id,
            vacancies_table.c.company_id == company_id,
        )
        .returning(vacancies_table.c.id)
    )
    result = await session.execute(stmt)
    await session.commit()
    deleted = result.first()

    if not deleted:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    return {"status": "ok"}
