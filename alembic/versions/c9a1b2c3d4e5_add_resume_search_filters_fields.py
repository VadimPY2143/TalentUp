"""add resume search filter fields

Revision ID: c9a1b2c3d4e5
Revises: b2c3d4e5f6a7
Create Date: 2026-03-19 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c9a1b2c3d4e5"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("resumes", sa.Column("employment_kind", sa.ARRAY(sa.String(length=50))))
    op.add_column("resumes", sa.Column("city", sa.String(length=100)))
    op.add_column("resumes", sa.Column("country", sa.String(length=100)))
    op.add_column("resumes", sa.Column("location_lat", sa.Float()))
    op.add_column("resumes", sa.Column("location_lng", sa.Float()))
    op.add_column("resumes", sa.Column("salary_period", sa.String(length=10)))
    op.add_column("resumes", sa.Column("category", sa.String(length=100)))
    op.add_column("resumes", sa.Column("tags", sa.ARRAY(sa.String(length=50))))
    op.add_column("resumes", sa.Column("education_level", sa.String(length=20)))
    op.add_column("resumes", sa.Column("hard_skills", sa.ARRAY(sa.String(length=50))))
    op.add_column("resumes", sa.Column("soft_skills", sa.ARRAY(sa.String(length=50))))
    op.add_column("resumes", sa.Column("languages", sa.ARRAY(sa.String(length=30))))
    op.add_column("resumes", sa.Column("english_level", sa.String(length=2)))
    op.add_column("resumes", sa.Column("company_types", sa.ARRAY(sa.String(length=50))))
    op.add_column("resumes", sa.Column("company_size", sa.String(length=20)))
    op.add_column("resumes", sa.Column("work_schedule", sa.ARRAY(sa.String(length=20))))
    op.add_column("resumes", sa.Column("position_level", sa.String(length=20)))
    op.add_column("resumes", sa.Column("contract_types", sa.ARRAY(sa.String(length=20))))
    op.add_column("resumes", sa.Column("benefits", sa.ARRAY(sa.String(length=50))))
    op.add_column("resumes", sa.Column("hire_speed", sa.String(length=20)))


def downgrade() -> None:
    op.drop_column("resumes", "hire_speed")
    op.drop_column("resumes", "benefits")
    op.drop_column("resumes", "contract_types")
    op.drop_column("resumes", "position_level")
    op.drop_column("resumes", "work_schedule")
    op.drop_column("resumes", "company_size")
    op.drop_column("resumes", "company_types")
    op.drop_column("resumes", "english_level")
    op.drop_column("resumes", "languages")
    op.drop_column("resumes", "soft_skills")
    op.drop_column("resumes", "hard_skills")
    op.drop_column("resumes", "education_level")
    op.drop_column("resumes", "tags")
    op.drop_column("resumes", "category")
    op.drop_column("resumes", "salary_period")
    op.drop_column("resumes", "location_lng")
    op.drop_column("resumes", "location_lat")
    op.drop_column("resumes", "country")
    op.drop_column("resumes", "city")
    op.drop_column("resumes", "employment_kind")

