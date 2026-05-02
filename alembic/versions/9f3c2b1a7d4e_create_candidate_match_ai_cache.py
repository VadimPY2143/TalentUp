"""create candidate match ai cache

Revision ID: 9f3c2b1a7d4e
Revises: create_user_links_table
Create Date: 2026-05-02 20:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9f3c2b1a7d4e"
down_revision = "create_user_links_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "candidate_match_ai_cache",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("vacancy_id", sa.Integer(), sa.ForeignKey("vacancies.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "application_id",
            sa.Integer(),
            sa.ForeignKey("job_applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("vacancy_signature", sa.String(length=64), nullable=False),
        sa.Column("application_signature", sa.String(length=64), nullable=False),
        sa.Column("score_total", sa.Integer(), nullable=False),
        sa.Column("verdict", sa.String(length=32), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("model_name", sa.String(length=128), nullable=False),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("score_total >= 0 AND score_total <= 100", name="ck_candidate_match_ai_cache_score_total"),
        sa.UniqueConstraint(
            "vacancy_id",
            "application_id",
            "vacancy_signature",
            "application_signature",
            name="uq_candidate_match_ai_cache_signature",
        ),
    )
    op.create_index(
        "ix_candidate_match_ai_cache_vacancy_application",
        "candidate_match_ai_cache",
        ["vacancy_id", "application_id"],
    )
    op.create_index("ix_candidate_match_ai_cache_analyzed_at", "candidate_match_ai_cache", ["analyzed_at"])


def downgrade() -> None:
    op.drop_index("ix_candidate_match_ai_cache_analyzed_at", table_name="candidate_match_ai_cache")
    op.drop_index("ix_candidate_match_ai_cache_vacancy_application", table_name="candidate_match_ai_cache")
    op.drop_table("candidate_match_ai_cache")
