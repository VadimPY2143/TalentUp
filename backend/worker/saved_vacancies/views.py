from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session, saved_vacancies_table
from users.define_roles import require_roles

from .models import SavedVacancyCreateIn, SavedVacancyOut, SavedVacancyUpdateIn
from .services import SavedVacancyService

router = APIRouter(tags=["saved vacancies"])


@router.post(
    "/saved-vacancies",
    response_model=SavedVacancyOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_saved_vacancy(
    payload: SavedVacancyCreateIn,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> SavedVacancyOut:
    try:
        await SavedVacancyService.ensure_vacancy_exists(
            session=session,
            vacancy_id=payload.vacancy_id,
        )

        duplicate_stmt = select(saved_vacancies_table.c.id).where(
            saved_vacancies_table.c.user_id == current_user["id"],
            saved_vacancies_table.c.vacancy_id == payload.vacancy_id,
        )
        duplicate = (await session.execute(duplicate_stmt)).scalar_one_or_none()
        if duplicate is not None:
            raise HTTPException(status_code=409, detail="Vacancy is already saved")

        try:
            stmt = (
                insert(saved_vacancies_table)
                .values(
                    user_id=current_user["id"],
                    vacancy_id=payload.vacancy_id,
                    note=payload.note,
                )
                .returning(saved_vacancies_table.c.id)
            )
            result = await session.execute(stmt)
            saved_vacancy_id = result.scalar_one()
        except IntegrityError as exc:
            msg = str(getattr(exc, "orig", exc))
            if "uq_saved_vacancies_user_vacancy" in msg or "saved_vacancies" in msg:
                raise HTTPException(status_code=409, detail="Vacancy is already saved") from exc
            raise
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    row = await SavedVacancyService.get_saved_vacancy_for_user(
        session=session,
        saved_vacancy_id=saved_vacancy_id,
        user_id=current_user["id"],
    )
    return SavedVacancyService.build_saved_vacancy_out(row)


@router.get("/saved-vacancies", response_model=list[SavedVacancyOut])
async def list_saved_vacancies(
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> list[SavedVacancyOut]:
    stmt = SavedVacancyService.saved_vacancy_stmt(user_id=current_user["id"]).order_by(
        saved_vacancies_table.c.created_at.desc(),
        saved_vacancies_table.c.id.desc(),
    )
    result = await session.execute(stmt)
    return [SavedVacancyService.build_saved_vacancy_out(dict(row)) for row in result.mappings().all()]


@router.get("/saved-vacancies/{saved_vacancy_id}", response_model=SavedVacancyOut)
async def get_saved_vacancy(
    saved_vacancy_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> SavedVacancyOut:
    row = await SavedVacancyService.get_saved_vacancy_for_user(
        session=session,
        saved_vacancy_id=saved_vacancy_id,
        user_id=current_user["id"],
    )
    return SavedVacancyService.build_saved_vacancy_out(row)


@router.patch("/saved-vacancies/{saved_vacancy_id}", response_model=SavedVacancyOut)
async def update_saved_vacancy(
    saved_vacancy_id: int,
    payload: SavedVacancyUpdateIn,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> SavedVacancyOut:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(status_code=400, detail="No fields to update")

    stmt = (
        update(saved_vacancies_table)
        .where(
            saved_vacancies_table.c.id == saved_vacancy_id,
            saved_vacancies_table.c.user_id == current_user["id"],
        )
        .values(**values, updated_at=func.now())
        .returning(saved_vacancies_table.c.id)
    )
    result = await session.execute(stmt)
    updated_id = result.scalar_one_or_none()
    if updated_id is None:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Saved vacancy not found")

    await session.commit()
    row = await SavedVacancyService.get_saved_vacancy_for_user(
        session=session,
        saved_vacancy_id=updated_id,
        user_id=current_user["id"],
    )
    return SavedVacancyService.build_saved_vacancy_out(row)


@router.delete("/saved-vacancies/{saved_vacancy_id}")
async def delete_saved_vacancy(
    saved_vacancy_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["worker"])),
) -> dict[str, str]:
    stmt = (
        delete(saved_vacancies_table)
        .where(
            saved_vacancies_table.c.id == saved_vacancy_id,
            saved_vacancies_table.c.user_id == current_user["id"],
        )
        .returning(saved_vacancies_table.c.id)
    )
    result = await session.execute(stmt)
    deleted = result.scalar_one_or_none()
    if deleted is None:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Saved vacancy not found")

    await session.commit()
    return {"status": "ok"}
