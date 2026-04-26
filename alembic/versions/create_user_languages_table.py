"""create user languages table

Revision ID: create_user_languages_table
Revises: update_languages_to_ukrainian
Create Date: 2026-04-25 18:44:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'create_user_languages_table'
down_revision = 'update_languages_to_ukrainian'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE proficiency_level AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')")
    
    op.create_table(
        "user_languages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("language_id", sa.Integer(), sa.ForeignKey("languages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("proficiency_level", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "language_id", name="uq_user_languages_user_language"),
        sa.CheckConstraint("proficiency_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')", name="ck_user_languages_proficiency_level"),
    )
    op.create_index("ix_user_languages_user_id", "user_languages", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_languages_user_id", table_name="user_languages")
    op.drop_table("user_languages")
    op.execute("DROP TYPE proficiency_level")
