import os
from enum import Enum
from pathlib import Path
from typing import Any, Iterable

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import resumes_table
from .models import EmploymentType


class ResumeService:
    BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
    upload_dir = os.getenv("RESUME_UPLOAD_DIR")
    if upload_dir:
        upload_root_path = Path(upload_dir)
        if not upload_root_path.is_absolute():
            upload_root_path = BACKEND_DIR / upload_root_path
    else:
        upload_root_path = BACKEND_DIR / "uploads" / "resumes"
    UPLOAD_ROOT = upload_root_path.resolve()
    MAX_PDF_SIZE_BYTES = int(os.getenv("MAX_PDF_SIZE_BYTES", "5242880"))

    @staticmethod
    def _normalize_employment_token(value: EmploymentType | str) -> str | None:
        raw_value = value.value if isinstance(value, EmploymentType) else str(value)
        token = raw_value.strip().lower().replace("-", "").replace("_", "").replace(" ", "")
        if not token:
            return None
        if token == "remote":
            return EmploymentType.REMOTE.value
        if token == "hybrid":
            return EmploymentType.HYBRID.value
        if token in {"office", "onsite", "offline"}:
            return EmploymentType.OFFICE.value
        return raw_value.strip()

    @classmethod
    def normalize_employment_type(
        cls,
        value: Iterable[EmploymentType | str] | None,
    ) -> list[str] | None:
        if value is None:
            return None

        normalized_values = [
            normalized
            for item in value
            if (normalized := cls._normalize_employment_token(item)) is not None
        ]
        return list(dict.fromkeys(normalized_values))

    @staticmethod
    def normalize_enum_list(value: Iterable[Enum | str] | None) -> list[str] | None:
        if value is None:
            return None
        return [item.value if isinstance(item, Enum) else str(item) for item in value]

    @staticmethod
    async def get_owned_resume(
        session: AsyncSession,
        resume_id: int,
        user_id: int,
    ) -> dict[str, Any]:
        stmt = select(resumes_table).where(resumes_table.c.id == resume_id)
        result = await session.execute(stmt)
        resume = result.mappings().first()

        if resume is None:
            raise HTTPException(status_code=404, detail="Resume not found")
        if resume["user_id"] != user_id:
            raise HTTPException(
                status_code=403,
                detail="Resume does not belong to current user",
            )
        return dict(resume)

    @classmethod
    def remove_pdf_from_disk(cls, pdf_file_path: str | None) -> None:
        if not pdf_file_path:
            return
        file_path = (cls.BACKEND_DIR / pdf_file_path).resolve()
        if file_path.exists():
            file_path.unlink()
