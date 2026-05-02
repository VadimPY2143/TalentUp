from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any


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


def _normalize_signature_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {
            str(key): _normalize_signature_value(sub_value)
            for key, sub_value in sorted(value.items(), key=lambda item: str(item[0]))
        }
    if isinstance(value, (list, tuple, set)):
        normalized_items = [_normalize_signature_value(item) for item in value]
        return sorted(normalized_items, key=lambda item: json.dumps(item, ensure_ascii=False, sort_keys=True))
    return str(value)


def build_content_signature(payload: dict[str, Any]) -> str:
    normalized_payload = _normalize_signature_value(payload)
    serialized = json.dumps(normalized_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
