"""create user links table

Revision ID: create_user_links_table
Revises: create_user_languages_table
Create Date: 2026-04-25 18:54:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'create_user_links_table'
down_revision = 'create_user_languages_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_links",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "url", name="uq_user_links_user_url"),
    )
    op.create_index("ix_user_links_user_id", "user_links", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_links_user_id", table_name="user_links")
    op.drop_table("user_links")
