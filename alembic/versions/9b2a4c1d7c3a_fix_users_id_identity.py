"""fix users id identity

Revision ID: 9b2a4c1d7c3a
Revises: 86cddd5541f4
Create Date: 2026-02-22 15:02:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9b2a4c1d7c3a"
down_revision = "86cddd5541f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure sequence exists and is owned by users.id
    op.execute("CREATE SEQUENCE IF NOT EXISTS users_id_seq")
    op.execute("ALTER SEQUENCE users_id_seq OWNED BY users.id")

    # Backfill NULL ids for existing rows
    op.execute("UPDATE users SET id = nextval('users_id_seq') WHERE id IS NULL")

    # Set default for future inserts and enforce NOT NULL
    op.execute("ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('users_id_seq')")
    op.execute("ALTER TABLE users ALTER COLUMN id SET NOT NULL")

    # Add primary key if missing
    op.execute("ALTER TABLE users ADD CONSTRAINT pk_users PRIMARY KEY (id)")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS pk_users")
    op.execute("ALTER TABLE users ALTER COLUMN id DROP DEFAULT")
    op.execute("ALTER TABLE users ALTER COLUMN id DROP NOT NULL")
    op.execute("DROP SEQUENCE IF EXISTS users_id_seq")
