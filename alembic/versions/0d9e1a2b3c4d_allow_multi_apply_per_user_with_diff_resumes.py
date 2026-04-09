"""allow multiple applications per user with different resumes

Revision ID: 0d9e1a2b3c4d
Revises: a9b8c7d6e5f4
Create Date: 2026-04-09 18:05:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "0d9e1a2b3c4d"
down_revision = "a9b8c7d6e5f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_job_applications_user_vacancy")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_job_applications_vacancy_resume
        ON job_applications (vacancy_id, resume_id)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_job_applications_vacancy_resume")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_job_applications_user_vacancy
        ON job_applications (user_id, vacancy_id)
        """
    )
