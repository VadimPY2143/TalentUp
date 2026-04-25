import json
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

from cities.service import CityService
from database import (
    async_session_factory,
    city_aliases_table,
    cities_table,
    resumes_table,
    vacancies_table,
)

DATA_FILE = Path(__file__).resolve().parent / "data" / "ua_cities.json"


def build_slug(name_uk: str, oblast: str) -> str:
    normalized_name = CityService.normalize_text(name_uk).replace(" ", "-")
    normalized_oblast = CityService.normalize_text(oblast).replace(" ", "-")
    return f"{normalized_name}-{normalized_oblast}"


def load_city_records() -> list[dict]:
    raw_records = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    records_by_slug: dict[str, dict] = {}
    for item in raw_records:
        name_uk = str(item["name_uk"]).strip()
        oblast = str(item["oblast"]).strip()
        name_en = str(item.get("name_en") or CityService.transliterate_name(name_uk)).strip()
        slug = build_slug(name_uk=name_uk, oblast=oblast)
        records_by_slug[slug] = {
            "slug": slug,
            "name_uk": name_uk,
            "name_en": name_en,
            "oblast": oblast,
            "normalized_name": CityService.normalize_text(name_uk),
            "is_active": True,
        }
    return list(records_by_slug.values())


def build_alias_records(city_rows: list[dict]) -> list[dict]:
    alias_records: dict[tuple[int, str], dict] = {}
    for city in city_rows:
        for alias in CityService.build_aliases(city["name_uk"], city["name_en"]):
            normalized_alias = CityService.normalize_text(alias)
            alias_records[(city["id"], normalized_alias)] = {
                "city_id": city["id"],
                "alias": alias,
                "normalized_alias": normalized_alias,
            }
    return list(alias_records.values())


async def sync_city_aliases(session) -> None:
    city_rows = (await session.execute(select(cities_table))).mappings().all()
    alias_records = build_alias_records([dict(row) for row in city_rows])
    if not alias_records:
        return

    stmt = insert(city_aliases_table).values(alias_records)
    stmt = stmt.on_conflict_do_update(
        index_elements=[city_aliases_table.c.city_id, city_aliases_table.c.normalized_alias],
        set_={"alias": stmt.excluded.alias},
    )
    await session.execute(stmt)


async def backfill_city_links(session) -> None:
    city_service = CityService(session=session)

    resume_rows = (
        await session.execute(select(resumes_table.c.id, resumes_table.c.location, resumes_table.c.city_id))
    ).mappings().all()
    for row in resume_rows:
        if row["city_id"] is not None or not row["location"]:
            continue
        city = await city_service.find_city_by_alias(row["location"])
        if city is None:
            continue
        await session.execute(
            update(resumes_table)
            .where(resumes_table.c.id == row["id"])
            .values(city_id=city["id"], location=city["name_uk"])
        )

    vacancy_rows = (
        await session.execute(select(vacancies_table.c.id, vacancies_table.c.location, vacancies_table.c.city_id))
    ).mappings().all()
    for row in vacancy_rows:
        if row["city_id"] is not None or not row["location"]:
            continue
        city = await city_service.find_city_by_alias(row["location"])
        if city is None:
            continue
        await session.execute(
            update(vacancies_table)
            .where(vacancies_table.c.id == row["id"])
            .values(city_id=city["id"], location=city["name_uk"])
        )


async def seed_cities() -> None:
    records = load_city_records()
    if not records:
        return

    stmt = insert(cities_table).values(records)
    stmt = stmt.on_conflict_do_update(
        index_elements=[cities_table.c.slug],
        set_={
            "name_uk": stmt.excluded.name_uk,
            "name_en": stmt.excluded.name_en,
            "oblast": stmt.excluded.oblast,
            "normalized_name": stmt.excluded.normalized_name,
            "is_active": stmt.excluded.is_active,
        },
    )

    async with async_session_factory() as session:
        await session.execute(stmt)
        await sync_city_aliases(session)
        await backfill_city_links(session)
        await session.commit()


if __name__ == "__main__":
    import asyncio

    asyncio.run(seed_cities())
