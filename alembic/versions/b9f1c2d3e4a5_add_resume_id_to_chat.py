"""add resume_id to chat

Revision ID: b9f1c2d3e4a5
Revises: 7e3f9a2b1c4d
Create Date: 2026-03-28 18:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b9f1c2d3e4a5"
down_revision = "7e3f9a2b1c4d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("chat", sa.Column("resume_id", sa.Integer(), nullable=True))
    op.create_index("ix_chat_resume_id", "chat", ["resume_id"])
    op.create_foreign_key(
        "fk_chat_resume_id_resumes",
        "chat",
        "resumes",
        ["resume_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute(
        """
        UPDATE chat AS c
        SET resume_id = src.resume_id
        FROM (
            SELECT DISTINCT ON (r.user_id)
                r.user_id,
                r.id AS resume_id
            FROM resumes AS r
            ORDER BY r.user_id, r.updated_at DESC, r.id DESC
        ) AS src
        WHERE c.worker_user_id = src.user_id
          AND c.resume_id IS NULL
        """
    )

    op.drop_constraint("uq_chat_vacancy_worker", "chat", type_="unique")
    op.create_unique_constraint("uq_chat_vacancy_resume", "chat", ["vacancy_id", "resume_id"])


def downgrade() -> None:
    op.drop_constraint("uq_chat_vacancy_resume", "chat", type_="unique")
    op.create_unique_constraint("uq_chat_vacancy_worker", "chat", ["vacancy_id", "worker_user_id"])
    op.drop_constraint("fk_chat_resume_id_resumes", "chat", type_="foreignkey")
    op.drop_index("ix_chat_resume_id", table_name="chat")
    op.drop_column("chat", "resume_id")
