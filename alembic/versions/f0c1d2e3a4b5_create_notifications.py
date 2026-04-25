"""create notifications

Revision ID: f0c1d2e3a4b5
Revises: 6f3a2b4c8d91, e3c4f5a6b7c8
Create Date: 2026-04-18 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "f0c1d2e3a4b5"
down_revision = ("6f3a2b4c8d91", "e3c4f5a6b7c8")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("entity_type", sa.String(length=100), nullable=True),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("payload_json", postgresql.JSONB(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Postgres needs explicit DESC in the index definition (planner can still scan backwards,
    # but we keep it aligned with the agreed schema).
    op.execute(
        "CREATE INDEX ix_notifications_user_is_read_created_at_desc "
        "ON notifications (user_id, is_read, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX ix_notifications_user_created_at_desc "
        "ON notifications (user_id, created_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_notifications_user_created_at_desc")
    op.execute("DROP INDEX IF EXISTS ix_notifications_user_is_read_created_at_desc")
    op.drop_table("notifications")

