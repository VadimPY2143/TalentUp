from __future__ import annotations


def normalize_work_formats(values: list[str] | None) -> set[str]:
    if not values:
        return set()

    normalized: set[str] = set()
    for value in values:
        token = str(value).strip().lower().replace("-", "").replace("_", "").replace(" ", "")
        if token == "remote":
            normalized.add("Remote")
        elif token == "hybrid":
            normalized.add("Hybrid")
        elif token in {"office", "onsite", "offline"}:
            normalized.add("Office")
    return normalized
