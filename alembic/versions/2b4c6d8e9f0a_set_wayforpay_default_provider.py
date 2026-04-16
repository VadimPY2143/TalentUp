"""set wayforpay as default payment provider

Revision ID: 2b4c6d8e9f0a
Revises: 1c2d3e4f5a6b
Create Date: 2026-04-16 12:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2b4c6d8e9f0a"
down_revision = "1c2d3e4f5a6b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "ALTER TABLE payment_orders ALTER COLUMN provider SET DEFAULT 'wayforpay'"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "ALTER TABLE payment_orders ALTER COLUMN provider SET DEFAULT 'liqpay'"
        )
    )
