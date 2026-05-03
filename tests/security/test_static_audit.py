from __future__ import annotations

import re
from pathlib import Path

import pytest


SKIP_DIRS = {
    ".venv",
    "frontend",
    "node_modules",
    "__pycache__",
    "logs",
    ".git",
}


def _iter_python_files(repo_root: Path):
    for p in repo_root.rglob("*.py"):
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        yield p


def _scan_file(path: Path) -> str:
    # Keep it simple; project uses UTF-8 but tolerate mixed encodings.
    return path.read_text(encoding="utf-8", errors="ignore")


@pytest.mark.parametrize(
    "pattern,why",
    [
        (r"\beval\s*\(", "Dynamic code execution (eval) is rarely safe."),
        (r"\bexec\s*\(", "Dynamic code execution (exec) is rarely safe."),
        (r"\bos\.system\s*\(", "Prefer subprocess without shell; os.system is hard to make safe."),
        (r"subprocess\.(Popen|run|call)\s*\(.*shell\s*=\s*True", "shell=True enables command injection."),
        (r"\bpickle\.loads?\s*\(", "Untrusted pickle is RCE."),
        (r"\byaml\.load\s*\(", "yaml.load without SafeLoader can be unsafe."),
        (r"requests\.(get|post|put|delete|patch)\s*\(.*verify\s*=\s*False", "TLS verification is disabled."),
        (r"httpx\.(get|post|put|delete|patch)\s*\(.*verify\s*=\s*False", "TLS verification is disabled."),
    ],
)
def test_no_high_risk_patterns_in_repo(pattern: str, why: str):
    repo_root = Path(__file__).resolve().parents[2]
    rx = re.compile(pattern, re.IGNORECASE | re.DOTALL)

    hits: list[str] = []
    for f in _iter_python_files(repo_root):
        txt = _scan_file(f)
        if rx.search(txt):
            hits.append(str(f.relative_to(repo_root)))

    assert not hits, f"Found risky pattern: {pattern} ({why}). Files: {', '.join(hits)}"


def test_no_obvious_hardcoded_jwt_secret():
    """
    Very rough heuristic to catch accidental hardcoding.
    Environment variables are expected; hardcoding secrets is not.
    """
    repo_root = Path(__file__).resolve().parents[2]
    rx = re.compile(r"JWT_SECRET_KEY\s*=\s*['\"][^'\"]+['\"]")

    hits: list[str] = []
    for f in _iter_python_files(repo_root):
        txt = _scan_file(f)
        if rx.search(txt):
            hits.append(str(f.relative_to(repo_root)))

    assert not hits, f"Possible hardcoded JWT secret detected. Files: {', '.join(hits)}"


def test_auth_helpers_do_not_return_password_field():
    """
    Returning password hashes from auth/session helper functions is a foot-gun:
    they can leak via logs or accidental response serialization.
    """
    repo_root = Path(__file__).resolve().parents[2]
    auth_py = repo_root / "backend" / "users" / "auth.py"
    if not auth_py.exists():
        pytest.skip("backend/users/auth.py not found")

    txt = _scan_file(auth_py)

    # Heuristic: any returned dict literal including a "password" key.
    rx = re.compile(r"return\s*{[^}]*['\"]password['\"]\s*:", re.IGNORECASE | re.DOTALL)
    assert not rx.search(txt), (
        "Auth helper returns a dict containing 'password'. "
        "Remove it from the returned structure to avoid accidental leaks "
        "(backend/users/auth.py)."
    )
