"""merge heads after main sync

Revision ID: 4e42555430ad
Revises: c1e2d3f4a5b6, e8a1b2c3d4e5
Create Date: 2026-03-28 23:39:29.582299
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4e42555430ad'
down_revision = ('c1e2d3f4a5b6', 'e8a1b2c3d4e5')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
