import os
import sys
from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def backend_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "backend"


@pytest.fixture(scope="session")
def app(backend_dir: Path):
    """
    Imports the FastAPI app as the backend runs it.
    We add `backend/` to sys.path so imports like `from cities.views import ...` work.
    """
    sys.path.insert(0, str(backend_dir))

    # Some libs look at this; keep consistent relative paths.
    os.environ.setdefault("PYTHONPATH", str(backend_dir))

    from main import app as fastapi_app  # noqa: WPS433 (import inside fixture is intentional)

    return fastapi_app

