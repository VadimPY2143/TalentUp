"""create resume_search_history table

Revision ID: f1b2c3d4e5f6
Revises: e4b8a7d2c9f1
Create Date: 2026-03-16 20:28:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f1b2c3d4e5f6"
down_revision = "e4b8a7d2c9f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "resume_search_history",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("search_text", sa.String(length=255), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("resume_search_history")
