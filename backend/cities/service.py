import re

from sqlalchemy import Select, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import cities_table, city_aliases_table


class CityService:
    TRANSLITERATION_MAP = {
        "а": "a",
        "б": "b",
        "в": "v",
        "г": "h",
        "ґ": "g",
        "д": "d",
        "е": "e",
        "є": "ie",
        "ж": "zh",
        "з": "z",
        "и": "y",
        "і": "i",
        "ї": "i",
        "й": "i",
        "к": "k",
        "л": "l",
        "м": "m",
        "н": "n",
        "о": "o",
        "п": "p",
        "р": "r",
        "с": "s",
        "т": "t",
        "у": "u",
        "ф": "f",
        "х": "kh",
        "ц": "ts",
        "ч": "ch",
        "ш": "sh",
        "щ": "shch",
        "ю": "iu",
        "я": "ia",
        "ь": "",
        "'": "",
        "’": "",
        " ": " ",
        "-": "-",
    }
    ENGLISH_NAME_OVERRIDES = {
        "київ": "Kyiv",
        "львів": "Lviv",
        "одеса": "Odesa",
        "харків": "Kharkiv",
        "дніпро": "Dnipro",
        "миколаїв": "Mykolaiv",
        "чернігів": "Chernihiv",
        "чернівці": "Chernivtsi",
        "вінниця": "Vinnytsia",
        "кропивницький": "Kropyvnytskyi",
        "запоріжжя": "Zaporizhzhia",
        "хмельницький": "Khmelnytskyi",
        "житомир": "Zhytomyr",
        "рівне": "Rivne",
        "тернопіль": "Ternopil",
        "суми": "Sumy",
        "луцьк": "Lutsk",
        "ужгород": "Uzhhorod",
        "івано франківськ": "Ivano-Frankivsk",
    }
    EXTRA_ALIASES = {
        "київ": ("Kiev",),
        "одеса": ("Odessa",),
        "харків": ("Kharkov",),
        "запоріжжя": ("Zaporozhye",),
        "миколаїв": ("Nikolaev",),
        "чернігів": ("Chernigov",),
        "чернівці": ("Chernovtsy",),
        "кропивницький": ("Kirovohrad", "Kirovograd"),
        "дніпро": ("Dnepr", "Dnipropetrovsk"),
        "львів": ("Lvov",),
    }

    def __init__(self, session: AsyncSession):
        self.session = session

    @staticmethod
    def normalize_text(value: str) -> str:
        normalized = re.sub(r"[^0-9a-zа-яіїєґ]+", " ", value.lower(), flags=re.IGNORECASE)
        return re.sub(r"\s+", " ", normalized).strip()

    @classmethod
    def transliterate_name(cls, value: str) -> str:
        normalized_source = cls.normalize_text(value)
        if normalized_source in cls.ENGLISH_NAME_OVERRIDES:
            return cls.ENGLISH_NAME_OVERRIDES[normalized_source]

        result = "".join(cls.TRANSLITERATION_MAP.get(char, char) for char in value.lower())
        return " ".join(part.capitalize() for part in result.split())

    @classmethod
    def build_aliases(cls, name_uk: str, name_en: str) -> list[str]:
        normalized_name = cls.normalize_text(name_uk)
        aliases = {
            name_uk.strip(),
            name_en.strip(),
            cls.normalize_text(name_uk),
            cls.normalize_text(name_en),
        }
        aliases.update(cls.EXTRA_ALIASES.get(normalized_name, ()))
        return [alias for alias in aliases if alias]

    async def list_options(self, query: str | None, limit: int) -> list[dict]:
        stmt = (
            select(
                cities_table.c.id,
                cities_table.c.name_uk,
                cities_table.c.name_en,
                cities_table.c.oblast,
            )
            .where(cities_table.c.is_active.is_(True))
            .order_by(cities_table.c.name_uk.asc())
            .limit(limit)
        )

        if query:
            trimmed_query = query.strip()
            if trimmed_query:
                normalized_query = self.normalize_text(trimmed_query)
                stmt = (
                    select(
                        cities_table.c.id,
                        cities_table.c.name_uk,
                        cities_table.c.name_en,
                        cities_table.c.oblast,
                    )
                    .select_from(cities_table.join(city_aliases_table, city_aliases_table.c.city_id == cities_table.c.id))
                    .where(cities_table.c.is_active.is_(True))
                    .where(
                        or_(
                            city_aliases_table.c.alias.ilike(f"%{trimmed_query}%"),
                            city_aliases_table.c.normalized_alias.ilike(f"%{normalized_query}%"),
                            cities_table.c.oblast.ilike(f"%{trimmed_query}%"),
                        )
                    )
                    .distinct()
                    .order_by(cities_table.c.name_uk.asc())
                    .limit(limit)
                )

        result = await self.session.execute(stmt)
        rows = result.mappings().all()
        return [
            {
                "id": row["id"],
                "name_uk": row["name_uk"],
                "name_en": row["name_en"],
                "oblast": row["oblast"],
                "label": f'{row["name_uk"]} / {row["name_en"]}, {row["oblast"]}',
            }
            for row in rows
        ]

    async def get_city_by_id(self, city_id: int) -> dict | None:
        stmt = select(cities_table).where(
            cities_table.c.id == city_id,
            cities_table.c.is_active.is_(True),
        )
        result = await self.session.execute(stmt)
        row = result.mappings().first()
        return dict(row) if row else None

    async def find_city_by_alias(self, value: str) -> dict | None:
        normalized_value = self.normalize_text(value)
        if not normalized_value:
            return None

        stmt: Select = (
            select(cities_table)
            .select_from(cities_table.join(city_aliases_table, city_aliases_table.c.city_id == cities_table.c.id))
            .where(
                cities_table.c.is_active.is_(True),
                city_aliases_table.c.normalized_alias == normalized_value,
            )
            .distinct()
            .limit(2)
        )
        result = await self.session.execute(stmt)
        rows = result.mappings().all()
        if len(rows) != 1:
            return None
        return dict(rows[0])

    async def resolve_city(self, city_id: int | None = None, location: str | None = None) -> dict | None:
        if city_id is not None:
            return await self.get_city_by_id(city_id)
        if location:
            return await self.find_city_by_alias(location)
        return None

    async def get_city_aliases(self, city_id: int) -> list[str]:
        stmt = select(city_aliases_table.c.alias).where(city_aliases_table.c.city_id == city_id)
        result = await self.session.execute(stmt)
        return [row[0] for row in result.all()]
