"""vacancy_search employment_type array

Revision ID: 3c5e8a9d2f7b
Revises: 2d7b4c9e6a1f
Create Date: 2026-02-28 12:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "3c5e8a9d2f7b"
down_revision = "2d7b4c9e6a1f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE resumes ALTER COLUMN employment_type TYPE VARCHAR(50)[] "
        "USING CASE WHEN employment_type IS NULL THEN NULL ELSE ARRAY[employment_type] END"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE resumes ALTER COLUMN employment_type TYPE VARCHAR(50) "
        "USING CASE WHEN employment_type IS NULL THEN NULL ELSE employment_type[1] END"
    )
