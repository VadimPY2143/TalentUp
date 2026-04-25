"""optimize analytics events indexes

Revision ID: a9b8c7d6e5f4
Revises: f0b1c2d3e4f5
Create Date: 2026-04-05 18:10:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "a9b8c7d6e5f4"
down_revision = "f0b1c2d3e4f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_analytics_events_occurred_at")
    op.execute("DROP INDEX IF EXISTS ix_analytics_events_event_type")
    op.execute("DROP INDEX IF EXISTS ix_analytics_events_actor_user_id")
    op.execute("DROP INDEX IF EXISTS ix_analytics_events_target_user_id")
    op.execute("DROP INDEX IF EXISTS ix_analytics_events_target_resume_id")

    op.create_index(
        "ix_analytics_events_type_target_user_occurred",
        "analytics_events",
        ["event_type", "target_user_id", "occurred_at"],
        unique=False,
    )
    op.create_index(
        "ix_analytics_events_type_target_resume_occurred",
        "analytics_events",
        ["event_type", "target_resume_id", "occurred_at"],
        unique=False,
    )
    op.create_index(
        "ix_analytics_events_actor_type_occurred",
        "analytics_events",
        ["actor_user_id", "event_type", "occurred_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_analytics_events_actor_type_occurred", table_name="analytics_events")
    op.drop_index("ix_analytics_events_type_target_resume_occurred", table_name="analytics_events")
    op.drop_index("ix_analytics_events_type_target_user_occurred", table_name="analytics_events")

    op.create_index("ix_analytics_events_target_resume_id", "analytics_events", ["target_resume_id"], unique=False)
    op.create_index("ix_analytics_events_target_user_id", "analytics_events", ["target_user_id"], unique=False)
    op.create_index("ix_analytics_events_actor_user_id", "analytics_events", ["actor_user_id"], unique=False)
    op.create_index("ix_analytics_events_event_type", "analytics_events", ["event_type"], unique=False)
    op.create_index("ix_analytics_events_occurred_at", "analytics_events", ["occurred_at"], unique=False)
