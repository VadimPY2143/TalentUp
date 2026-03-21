"""create saved_resumes table

Revision ID: b2c3d4e5f6a7
Revises: f1b2c3d4e5f6
Create Date: 2026-03-18 10:55:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "f1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_resumes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("saved_resume_id", sa.Integer, sa.ForeignKey("resumes.id"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("saved_resumes")
