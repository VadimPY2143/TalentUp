"""create languages catalog

Revision ID: a3d9c5b7e1f2
Revises: 8f4c2b1a9d6e
Create Date: 2026-04-24 21:25:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a3d9c5b7e1f2"
down_revision = "8f4c2b1a9d6e"
branch_labels = None
depends_on = None


LANGUAGES = [
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
    op.create_table(
        "languages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("popularity_rank", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("name", name="uq_languages_name"),
    )
    op.create_index("ix_languages_popularity_rank", "languages", ["popularity_rank"], unique=False)

    languages_table = sa.table(
        "languages",
        sa.column("name", sa.String(length=100)),
        sa.column("popularity_rank", sa.Integer()),
    )
    op.bulk_insert(
        languages_table,
        [{"name": name, "popularity_rank": index + 1} for index, name in enumerate(LANGUAGES)],
    )


def downgrade() -> None:
    op.drop_index("ix_languages_popularity_rank", table_name="languages")
    op.drop_table("languages")
