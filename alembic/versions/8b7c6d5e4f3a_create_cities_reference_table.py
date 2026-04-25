"""create cities reference table

Revision ID: 8b7c6d5e4f3a
Revises: 6f3a2b4c8d91
Create Date: 2026-04-03 11:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8b7c6d5e4f3a"
down_revision = "6f3a2b4c8d91"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cities",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("name_uk", sa.String(length=255), nullable=False),
        sa.Column("oblast", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("slug", name="uq_cities_slug"),
    )
    op.create_index("ix_cities_name_uk", "cities", ["name_uk"])
    op.create_index("ix_cities_normalized_name", "cities", ["normalized_name"])


def downgrade() -> None:
    op.drop_index("ix_cities_normalized_name", table_name="cities")
    op.drop_index("ix_cities_name_uk", table_name="cities")
    op.drop_table("cities")
