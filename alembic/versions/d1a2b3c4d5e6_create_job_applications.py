"""create job applications and application history

Revision ID: d1a2b3c4d5e6
Revises: f7c3e9a1b6d2
Create Date: 2026-03-28 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "d1a2b3c4d5e6"
down_revision = "f7c3e9a1b6d2"
branch_labels = None
depends_on = None


APPLICATION_STATUSES = ("applied", "viewed", "rejected", "accepted")
# The enum type may already exist in the database. Use a "create/drop" instance
# for DDL with checkfirst=True, and a "no-create" instance for columns to avoid
# duplicate CREATE TYPE during CREATE TABLE.
application_status_enum_ddl = postgresql.ENUM(*APPLICATION_STATUSES, name="application_status")
application_status_enum = postgresql.ENUM(*APPLICATION_STATUSES, name="application_status", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    application_status_enum_ddl.create(bind, checkfirst=True)

    op.create_table(
        "job_applications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("vacancy_id", sa.Integer(), sa.ForeignKey("vacancies.id"), nullable=False),
        sa.Column("cover_letter", sa.Text(), nullable=True),
        sa.Column("status", application_status_enum, nullable=False, server_default="applied"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("uq_job_applications_user_vacancy", "job_applications", ["user_id", "vacancy_id"], unique=True)
    op.create_index("ix_job_applications_user_id", "job_applications", ["user_id"], unique=False)
    op.create_index("ix_job_applications_vacancy_id", "job_applications", ["vacancy_id"], unique=False)

    op.create_table(
        "application_history",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "application_id",
            sa.Integer(),
            sa.ForeignKey("job_applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", application_status_enum, nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_application_history_application_id",
        "application_history",
        ["application_id"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index("ix_application_history_application_id", table_name="application_history")
    op.drop_table("application_history")

    op.drop_index("ix_job_applications_vacancy_id", table_name="job_applications")
    op.drop_index("ix_job_applications_user_id", table_name="job_applications")
    op.drop_index("uq_job_applications_user_vacancy", table_name="job_applications")
    op.drop_table("job_applications")

    application_status_enum_ddl.drop(bind, checkfirst=True)
