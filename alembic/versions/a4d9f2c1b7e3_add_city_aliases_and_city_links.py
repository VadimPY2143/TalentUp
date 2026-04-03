"""add city aliases and city links

Revision ID: a4d9f2c1b7e3
Revises: 8b7c6d5e4f3a
Create Date: 2026-04-03 13:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a4d9f2c1b7e3"
down_revision = "8b7c6d5e4f3a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cities", sa.Column("name_en", sa.String(length=255), nullable=True))
    op.execute("UPDATE cities SET name_en = name_uk WHERE name_en IS NULL")
    op.alter_column("cities", "name_en", existing_type=sa.String(length=255), nullable=False)

    op.create_table(
        "city_aliases",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("city_id", sa.Integer(), sa.ForeignKey("cities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alias", sa.String(length=255), nullable=False),
        sa.Column("normalized_alias", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("city_id", "normalized_alias", name="uq_city_aliases_city_alias"),
    )
    op.create_index("ix_city_aliases_normalized_alias", "city_aliases", ["normalized_alias"])

    op.add_column("resumes", sa.Column("city_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_resumes_city_id", "resumes", "cities", ["city_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_resumes_city_id", "resumes", ["city_id"])

    op.add_column("vacancies", sa.Column("city_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_vacancies_city_id", "vacancies", "cities", ["city_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_vacancies_city_id", "vacancies", ["city_id"])


def downgrade() -> None:
    op.drop_index("ix_vacancies_city_id", table_name="vacancies")
    op.drop_constraint("fk_vacancies_city_id", "vacancies", type_="foreignkey")
    op.drop_column("vacancies", "city_id")

    op.drop_index("ix_resumes_city_id", table_name="resumes")
    op.drop_constraint("fk_resumes_city_id", "resumes", type_="foreignkey")
    op.drop_column("resumes", "city_id")

    op.drop_index("ix_city_aliases_normalized_alias", table_name="city_aliases")
    op.drop_table("city_aliases")

    op.drop_column("cities", "name_en")
