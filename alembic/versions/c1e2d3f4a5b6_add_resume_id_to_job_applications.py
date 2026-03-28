"""add resume_id to job_applications

Revision ID: c1e2d3f4a5b6
Revises: b9f1c2d3e4a5, d1a2b3c4d5e7
Create Date: 2026-03-28 20:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c1e2d3f4a5b6"
down_revision = ("b9f1c2d3e4a5", "d1a2b3c4d5e7")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_applications", sa.Column("resume_id", sa.Integer(), nullable=True))
    op.create_index("ix_job_applications_resume_id", "job_applications", ["resume_id"], unique=False)
    op.create_foreign_key(
        "fk_job_applications_resume_id_resumes",
        "job_applications",
        "resumes",
        ["resume_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute(
        """
        UPDATE job_applications AS ja
        SET resume_id = src.resume_id
        FROM (
            SELECT DISTINCT ON (r.user_id)
                r.user_id,
                r.id AS resume_id
            FROM resumes AS r
            ORDER BY r.user_id, r.is_active DESC, r.updated_at DESC, r.id DESC
        ) AS src
        WHERE ja.user_id = src.user_id
          AND ja.resume_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_job_applications_resume_id_resumes", "job_applications", type_="foreignkey")
    op.drop_index("ix_job_applications_resume_id", table_name="job_applications")
    op.drop_column("job_applications", "resume_id")
