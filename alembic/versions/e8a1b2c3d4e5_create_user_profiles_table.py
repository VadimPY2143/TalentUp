"""create users profile table

Revision ID: e8a1b2c3d4e5
Revises: d1a2b3c4d5e6
Create Date: 2026-03-28 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "e8a1b2c3d4e5"
down_revision = "d1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users_profile",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("education", sa.String(length=255), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("languages", postgresql.ARRAY(sa.String(length=100)), nullable=True),
        sa.Column("links", postgresql.ARRAY(sa.String(length=255)), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_users_profile_user_id"),
    )


def downgrade() -> None:
    op.drop_table("users_profile")
