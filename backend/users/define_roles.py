from fastapi import Depends, HTTPException, status
from typing import Iterable
from .auth import get_current_user

def require_roles(allowed: Iterable[str]):
    async def _checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user
    return _checker
