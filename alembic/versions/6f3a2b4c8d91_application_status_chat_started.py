"""replace application statuses with chat_started flow

Revision ID: 6f3a2b4c8d91
Revises: 4e42555430ad
Create Date: 2026-03-30 19:05:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "6f3a2b4c8d91"
down_revision = "4e42555430ad"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE application_status_new AS ENUM ('applied', 'viewed', 'chat_started')")

    op.execute("ALTER TABLE job_applications ALTER COLUMN status DROP DEFAULT")
    op.execute(
        """
        ALTER TABLE job_applications
        ALTER COLUMN status TYPE application_status_new
        USING (
            CASE
                WHEN status::text = 'accepted' THEN 'chat_started'
                WHEN status::text = 'rejected' THEN 'viewed'
                ELSE status::text
            END
        )::application_status_new
        """
    )

    op.execute(
        """
        ALTER TABLE application_history
        ALTER COLUMN status TYPE application_status_new
        USING (
            CASE
                WHEN status::text = 'accepted' THEN 'chat_started'
                WHEN status::text = 'rejected' THEN 'viewed'
                ELSE status::text
            END
        )::application_status_new
        """
    )

    op.execute("DROP TYPE application_status")
    op.execute("ALTER TYPE application_status_new RENAME TO application_status")
    op.execute("ALTER TABLE job_applications ALTER COLUMN status SET DEFAULT 'applied'")


def downgrade() -> None:
    op.execute("CREATE TYPE application_status_old AS ENUM ('applied', 'viewed', 'rejected', 'accepted')")

    op.execute("ALTER TABLE job_applications ALTER COLUMN status DROP DEFAULT")
    op.execute(
        """
        ALTER TABLE job_applications
        ALTER COLUMN status TYPE application_status_old
        USING (
            CASE
                WHEN status::text = 'chat_started' THEN 'accepted'
                ELSE status::text
            END
        )::application_status_old
        """
    )

    op.execute(
        """
        ALTER TABLE application_history
        ALTER COLUMN status TYPE application_status_old
        USING (
            CASE
                WHEN status::text = 'chat_started' THEN 'accepted'
                ELSE status::text
            END
        )::application_status_old
        """
    )

    op.execute("DROP TYPE application_status")
    op.execute("ALTER TYPE application_status_old RENAME TO application_status")
    op.execute("ALTER TABLE job_applications ALTER COLUMN status SET DEFAULT 'applied'")

