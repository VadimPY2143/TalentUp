"""add vacancy_search pdf fields

Revision ID: 5a8c1d2e9f4b
Revises: 4f2d7b1a8c3e
Create Date: 2026-03-01 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "5a8c1d2e9f4b"
down_revision = "4f2d7b1a8c3e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("resumes", sa.Column("pdf_file_path", sa.String(length=500), nullable=True))
    op.add_column("resumes", sa.Column("pdf_original_name", sa.String(length=255), nullable=True))
    op.add_column("resumes", sa.Column("pdf_size", sa.Integer(), nullable=True))
    op.add_column("resumes", sa.Column("pdf_uploaded_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("resumes", "pdf_uploaded_at")
    op.drop_column("resumes", "pdf_size")
    op.drop_column("resumes", "pdf_original_name")
    op.drop_column("resumes", "pdf_file_path")
