"""create resumes table

Revision ID: 2d7b4c9e6a1f
Revises: 1f2c9c6b8e2a
Create Date: 2026-02-28 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2d7b4c9e6a1f"
down_revision = "1f2c9c6b8e2a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "resumes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("summary", sa.Text()),
        sa.Column("desired_role", sa.String(length=255)),
        sa.Column("employment_type", sa.String(length=50)),
        sa.Column("location", sa.String(length=255)),
        sa.Column("salary_min", sa.Integer()),
        sa.Column("salary_max", sa.Integer()),
        sa.Column("salary_currency", sa.String(length=10)),
        sa.Column("years_experience", sa.Integer()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_resumes_desired_role", "resumes", ["desired_role"])


def downgrade() -> None:
    op.drop_index("ix_resumes_desired_role", table_name="resumes")
    op.drop_table("resumes")
