"""add user role

Revision ID: 1f2c9c6b8e2a
Revises: 9b2a4c1d7c3a
Create Date: 2026-02-22 15:10:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "1f2c9c6b8e2a"
down_revision = "9b2a4c1d7c3a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_role = sa.Enum("employer", "worker", name="user_role")
    user_role.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "users",
        sa.Column(
            "role",
            user_role,
            nullable=False,
            server_default=sa.text("'worker'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "role")
    sa.Enum("employer", "worker", name="user_role").drop(op.get_bind(), checkfirst=True)
