"""create analytics events

Revision ID: e3c4f5a6b7c8
Revises: d1a2b3c4d5e6
Create Date: 2026-04-05 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "e3c4f5a6b7c8"
down_revision = "d1a2b3c4d5e6"
branch_labels = None
depends_on = None


ANALYTICS_EVENT_TYPES = ("profile_view", "resume_view", "contact_click")
analytics_event_type_enum_ddl = postgresql.ENUM(*ANALYTICS_EVENT_TYPES, name="analytics_event_type")
analytics_event_type_enum = postgresql.ENUM(
    *ANALYTICS_EVENT_TYPES, name="analytics_event_type", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    analytics_event_type_enum_ddl.create(bind, checkfirst=True)

    op.create_table(
        "analytics_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("target_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("target_resume_id", sa.Integer(), sa.ForeignKey("resumes.id"), nullable=True),
        sa.Column("event_type", analytics_event_type_enum, nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index("ix_analytics_events_occurred_at", "analytics_events", ["occurred_at"], unique=False)
    op.create_index("ix_analytics_events_event_type", "analytics_events", ["event_type"], unique=False)
    op.create_index("ix_analytics_events_actor_user_id", "analytics_events", ["actor_user_id"], unique=False)
    op.create_index("ix_analytics_events_target_user_id", "analytics_events", ["target_user_id"], unique=False)
    op.create_index("ix_analytics_events_target_resume_id", "analytics_events", ["target_resume_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index("ix_analytics_events_target_resume_id", table_name="analytics_events")
    op.drop_index("ix_analytics_events_target_user_id", table_name="analytics_events")
    op.drop_index("ix_analytics_events_actor_user_id", table_name="analytics_events")
    op.drop_index("ix_analytics_events_event_type", table_name="analytics_events")
    op.drop_index("ix_analytics_events_occurred_at", table_name="analytics_events")
    op.drop_table("analytics_events")

    analytics_event_type_enum_ddl.drop(bind, checkfirst=True)

