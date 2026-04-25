from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from database import companies_table, get_session
from users.define_roles import require_roles
from .models import Company, CompanyResponse, CompanyUpdate

router = APIRouter(tags=["companies"])


@router.post("/companies", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    company: Company,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> CompanyResponse:
    check_company_exists_stmt = select(companies_table.c.id).where(
        companies_table.c.user_id == current_user["id"]
    )
    check_company_exists_result = await session.execute(check_company_exists_stmt)
    check_company_exists = check_company_exists_result.first()
    if check_company_exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Company already exists",
        )

    stmt = (
        insert(companies_table)
        .values(user_id=current_user["id"], **company.model_dump(exclude_none=True))
        .returning(*companies_table.c)
    )
    result = await session.execute(stmt)
    await session.commit()
    row = result.mappings().one()
    return CompanyResponse(**row)


@router.get("/companies", response_model=list[CompanyResponse])
async def list_my_companies(
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> list[CompanyResponse]:
    stmt = (
        select(companies_table)
        .where(companies_table.c.user_id == current_user["id"])
        .order_by(companies_table.c.created_at.desc(), companies_table.c.id.desc())
    )
    result = await session.execute(stmt)
    rows = result.mappings().all()
    return [CompanyResponse(**row) for row in rows]


@router.get("/companies/{company_id}", response_model=CompanyResponse)
async def get_company_by_id(
    company_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer", "worker"])),
) -> CompanyResponse:
    stmt = select(companies_table).where(companies_table.c.id == company_id)
    if current_user["role"] == "employer":
        stmt = stmt.where(companies_table.c.user_id == current_user["id"])
    result = await session.execute(stmt)
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Company not found")
    return CompanyResponse(**row)


@router.put("/companies/{company_id}", response_model=CompanyResponse)
async def update_company_by_id(
    company_id: int,
    payload: CompanyUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(require_roles(["employer"])),
) -> CompanyResponse:
    values = payload.model_dump(exclude_unset=True, exclude_none=True)

    if not values:
        raise HTTPException(status_code=404, detail="No fields to update")

    stmt = (
        update(companies_table)
        .where(
            companies_table.c.id == company_id,
            companies_table.c.user_id == current_user["id"],
        )
        .values(**values)
        .returning(*companies_table.c)
    )
    result = await session.execute(stmt)
    await session.commit()
    row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Company not found")

    return CompanyResponse(**row)
