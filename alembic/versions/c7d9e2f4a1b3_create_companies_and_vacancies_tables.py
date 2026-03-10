"""create companies and vacancies tables

Revision ID: c7d9e2f4a1b3
Revises: 5a8c1d2e9f4b
Create Date: 2026-03-06 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c7d9e2f4a1b3"
down_revision = "5a8c1d2e9f4b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("legal_name", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("industry", sa.String(length=100), nullable=True),
        sa.Column("company_size", sa.String(length=50), nullable=True),
        sa.Column("website", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("founded_year", sa.Integer(), nullable=True),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("user_id", name="uq_companies_user_id"),
    )
    op.create_index("ix_companies_name", "companies", ["name"])
    op.create_index("ix_companies_industry", "companies", ["industry"])

    op.create_table(
        "vacancies",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("responsibilities", sa.Text(), nullable=True),
        sa.Column("requirements", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("employment_type", sa.ARRAY(sa.String(length=50)), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("salary_min", sa.Integer(), nullable=True),
        sa.Column("salary_max", sa.Integer(), nullable=True),
        sa.Column("salary_currency", sa.String(length=10), nullable=True),
        sa.Column("experience_years_min", sa.Integer(), nullable=True),
        sa.Column("experience_years_max", sa.Integer(), nullable=True),
        sa.Column("work_format", sa.ARRAY(sa.String(length=50)), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_vacancies_company_id", "vacancies", ["company_id"])
    op.create_index("ix_vacancies_is_active", "vacancies", ["is_active"])
    op.create_index("ix_vacancies_title", "vacancies", ["title"])


def downgrade() -> None:
    op.drop_index("ix_vacancies_title", table_name="vacancies")
    op.drop_index("ix_vacancies_is_active", table_name="vacancies")
    op.drop_index("ix_vacancies_company_id", table_name="vacancies")
    op.drop_table("vacancies")

    op.drop_index("ix_companies_industry", table_name="companies")
    op.drop_index("ix_companies_name", table_name="companies")
    op.drop_table("companies")
