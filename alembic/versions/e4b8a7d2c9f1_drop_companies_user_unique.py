"""drop companies user unique constraint

Revision ID: e4b8a7d2c9f1
Revises: c7d9e2f4a1b3
Create Date: 2026-03-06 23:10:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "e4b8a7d2c9f1"
down_revision = "c7d9e2f4a1b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE companies DROP CONSTRAINT IF EXISTS uq_companies_user_id")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE companies ADD CONSTRAINT uq_companies_user_id UNIQUE (user_id)"
    )
