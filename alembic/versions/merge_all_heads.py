"""merge all heads

Revision ID: merge_all_heads
Revises: a3d9c5b7e1f2, merge_feature_branches
Create Date: 2026-04-25 18:31:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'merge_all_heads'
down_revision = ('a3d9c5b7e1f2', 'merge_feature_branches')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
