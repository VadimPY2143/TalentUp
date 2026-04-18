"""merge feature branches

Revision ID: merge_feature_branches
Revises: ('f0c1d2e3a4b5', '8f4c2b1a9d6e', '2b4c6d8e9f0a')
Create Date: 2026-04-18 16:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'merge_feature_branches'
down_revision = ('f0c1d2e3a4b5', '8f4c2b1a9d6e', '2b4c6d8e9f0a')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
