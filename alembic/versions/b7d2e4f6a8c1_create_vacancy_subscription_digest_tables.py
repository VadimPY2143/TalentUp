"""create vacancy subscription digest tables

Revision ID: b7d2e4f6a8c1
Revises: a4d9f2c1b7e3
Create Date: 2026-04-05 12:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b7d2e4f6a8c1"
down_revision = "a4d9f2c1b7e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vacancy_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("search_text", sa.String(length=255), nullable=False),
        sa.Column("filters", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_vacancy_subscriptions_user_id", "vacancy_subscriptions", ["user_id"])
    op.create_index(
        "ix_vacancy_subscriptions_due",
        "vacancy_subscriptions",
        ["is_active", "next_run_at"],
    )

    op.create_table(
        "vacancy_subscription_deliveries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("subscription_id", sa.Integer(), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("vacancies_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["subscription_id"], ["vacancy_subscriptions.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "subscription_id",
            "period_start",
            "period_end",
            name="uq_vacancy_subscription_deliveries_period",
        ),
    )
    op.create_index(
        "ix_vacancy_subscription_deliveries_subscription_id",
        "vacancy_subscription_deliveries",
        ["subscription_id"],
    )
    op.create_index(
        "ix_vacancy_subscription_deliveries_status",
        "vacancy_subscription_deliveries",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("ix_vacancy_subscription_deliveries_status", table_name="vacancy_subscription_deliveries")
    op.drop_index(
        "ix_vacancy_subscription_deliveries_subscription_id",
        table_name="vacancy_subscription_deliveries",
    )
    op.drop_table("vacancy_subscription_deliveries")

    op.drop_index("ix_vacancy_subscriptions_due", table_name="vacancy_subscriptions")
    op.drop_index("ix_vacancy_subscriptions_user_id", table_name="vacancy_subscriptions")
    op.drop_table("vacancy_subscriptions")
