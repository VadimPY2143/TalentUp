"""update languages to ukrainian

Revision ID: update_languages_to_ukrainian
Revises: merge_all_heads
Create Date: 2026-04-25 18:42:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'update_languages_to_ukrainian'
down_revision = 'merge_all_heads'
branch_labels = None
depends_on = None


LANGUAGES_UKRAINIAN = [
    "Англійська",
    "Українська",
    "Польська",
    "Німецька",
    "Французька",
    "Іспанська",
    "Італійська",
    "Португальська",
    "Нідерландська",
    "Чеська",
    "Словацька",
    "Румунська",
    "Угорська",
    "Турецька",
    "Китайська",
    "Японська",
    "Корейська",
    "Арабська",
    "Гінді",
    "Бенгальська",
    "Пенджабська",
    "Урду",
    "Іврит",
    "Грецька",
    "Болгарська",
    "Хорватська",
    "Сербська",
    "Словенська",
    "Литовська",
    "Латвійська",
    "Естонська",
    "Шведська",
    "Норвезька",
    "Данська",
    "Фінська",
    "Російська",
    "Грузинська",
    "Вірменська",
    "Азербайджанська",
    "Казахська",
]


def upgrade() -> None:
    op.execute("DELETE FROM languages")
    
    languages_table = sa.table(
        "languages",
        sa.column("name", sa.String(length=100)),
        sa.column("popularity_rank", sa.Integer()),
    )
    op.bulk_insert(
        languages_table,
        [{"name": name, "popularity_rank": index + 1} for index, name in enumerate(LANGUAGES_UKRAINIAN)],
    )


def downgrade() -> None:
    op.execute("DELETE FROM languages")
    
    LANGUAGES_ENGLISH = [
        "English",
        "Ukrainian",
        "Polish",
        "German",
        "French",
        "Spanish",
        "Italian",
        "Portuguese",
        "Dutch",
        "Czech",
        "Slovak",
        "Romanian",
        "Hungarian",
        "Turkish",
        "Chinese",
        "Japanese",
        "Korean",
        "Arabic",
        "Hindi",
        "Bengali",
        "Punjabi",
        "Urdu",
        "Hebrew",
        "Greek",
        "Bulgarian",
        "Croatian",
        "Serbian",
        "Slovenian",
        "Lithuanian",
        "Latvian",
        "Estonian",
        "Swedish",
        "Norwegian",
        "Danish",
        "Finnish",
        "Russian",
        "Georgian",
        "Armenian",
        "Azerbaijani",
        "Kazakh",
    ]
    
    languages_table = sa.table(
        "languages",
        sa.column("name", sa.String(length=100)),
        sa.column("popularity_rank", sa.Integer()),
    )
    op.bulk_insert(
        languages_table,
        [{"name": name, "popularity_rank": index + 1} for index, name in enumerate(LANGUAGES_ENGLISH)],
    )
