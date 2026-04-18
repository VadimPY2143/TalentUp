"""create saved_vacancies table

Revision ID: 8f4c2b1a9d6e
Revises: 7e3f9a2b1c4d
Create Date: 2026-04-16 21:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8f4c2b1a9d6e"
down_revision = "7e3f9a2b1c4d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_vacancies",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vacancy_id", sa.Integer(), sa.ForeignKey("vacancies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "uq_saved_vacancies_user_vacancy",
        "saved_vacancies",
        ["user_id", "vacancy_id"],
        unique=True,
    )
    op.create_index("ix_saved_vacancies_user_id", "saved_vacancies", ["user_id"], unique=False)
    op.create_index("ix_saved_vacancies_vacancy_id", "saved_vacancies", ["vacancy_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_saved_vacancies_vacancy_id", table_name="saved_vacancies")
    op.drop_index("ix_saved_vacancies_user_id", table_name="saved_vacancies")
    op.drop_index("uq_saved_vacancies_user_vacancy", table_name="saved_vacancies")
    op.drop_table("saved_vacancies")
