"""create credit billing tables

Revision ID: 1c2d3e4f5a6b
Revises: 0d9e1a2b3c4d
Create Date: 2026-04-15 21:15:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "1c2d3e4f5a6b"
down_revision = "0d9e1a2b3c4d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'payment_order_status'
                ) THEN
                    CREATE TYPE payment_order_status AS ENUM ('pending', 'success', 'failed', 'expired');
                END IF;
            END $$;
            """
        )
    )
    payment_order_status = postgresql.ENUM(
        "pending",
        "success",
        "failed",
        "expired",
        name="payment_order_status",
        create_type=False,
    )
    credit_transaction_type = postgresql.ENUM(
        "purchase",
        "debit",
        "refund",
        "manual_adjustment",
        name="credit_transaction_type",
        create_type=False,
    )
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'credit_transaction_type'
                ) THEN
                    CREATE TYPE credit_transaction_type AS ENUM ('purchase', 'debit', 'refund', 'manual_adjustment');
                END IF;
            END $$;
            """
        )
    )

    op.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER"))
    op.execute(sa.text("UPDATE users SET credits = 0 WHERE credits IS NULL"))
    op.execute(sa.text("ALTER TABLE users ALTER COLUMN credits SET DEFAULT 0"))
    op.execute(sa.text("ALTER TABLE users ALTER COLUMN credits SET NOT NULL"))
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'ck_users_credits_non_negative'
                ) THEN
                    ALTER TABLE users
                    ADD CONSTRAINT ck_users_credits_non_negative
                    CHECK (credits >= 0);
                END IF;
            END $$;
            """
        )
    )

    op.create_table(
        "credit_packages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("credits", sa.Integer(), nullable=False),
        sa.Column("price_uah", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("credits > 0", name="ck_credit_packages_credits_positive"),
        sa.CheckConstraint("price_uah > 0", name="ck_credit_packages_price_positive"),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "payment_orders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False, server_default=sa.text("'liqpay'")),
        sa.Column("provider_order_id", sa.String(length=128), nullable=False),
        sa.Column("amount_uah", sa.Integer(), nullable=False),
        sa.Column("status", payment_order_status, nullable=False, server_default=sa.text("'pending'")),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("provider_payload", sa.JSON(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("amount_uah > 0", name="ck_payment_orders_amount_positive"),
        sa.ForeignKeyConstraint(["package_id"], ["credit_packages.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("provider_order_id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_payment_orders_user_id", "payment_orders", ["user_id"])
    op.create_index("ix_payment_orders_status", "payment_orders", ["status"])

    op.create_table(
        "credit_transactions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("type", credit_transaction_type, nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("feature_code", sa.String(length=64), nullable=True),
        sa.Column("reference_type", sa.String(length=64), nullable=True),
        sa.Column("reference_id", sa.String(length=128), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("balance_after >= 0", name="ck_credit_transactions_balance_non_negative"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index(
        "ix_credit_transactions_user_id_created_at",
        "credit_transactions",
        ["user_id", "created_at"],
    )
    op.create_index("ix_credit_transactions_feature_code", "credit_transactions", ["feature_code"])

    packages_table = sa.table(
        "credit_packages",
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("credits", sa.Integer),
        sa.column("price_uah", sa.Integer),
        sa.column("is_active", sa.Boolean),
    )
    op.bulk_insert(
        packages_table,
        [
            {"code": "START_50", "name": "Start 50", "credits": 50, "price_uah": 249, "is_active": True},
            {"code": "HR_120", "name": "HR 120", "credits": 120, "price_uah": 549, "is_active": True},
            {"code": "TEAM_300", "name": "Team 300", "credits": 300, "price_uah": 1190, "is_active": True},
            {"code": "SCALE_700", "name": "Scale 700", "credits": 700, "price_uah": 2390, "is_active": True},
            {"code": "PRO_1500", "name": "Pro 1500", "credits": 1500, "price_uah": 4490, "is_active": True},
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_credit_transactions_feature_code", table_name="credit_transactions")
    op.drop_index("ix_credit_transactions_user_id_created_at", table_name="credit_transactions")
    op.drop_table("credit_transactions")

    op.drop_index("ix_payment_orders_status", table_name="payment_orders")
    op.drop_index("ix_payment_orders_user_id", table_name="payment_orders")
    op.drop_table("payment_orders")

    op.drop_table("credit_packages")

    op.drop_constraint("ck_users_credits_non_negative", "users", type_="check")
    op.alter_column("users", "credits", server_default=None)

    op.execute(sa.text("DROP TYPE IF EXISTS credit_transaction_type"))
    op.execute(sa.text("DROP TYPE IF EXISTS payment_order_status"))
