"""add security columns to users

Revision ID: 0002_security_columns
Revises: 0001_initial
Create Date: 2024-01-02 00:00:00.000000

Adds columns used by the Redis-backed failed-attempt tracking as a
persistent fallback audit trail (the authoritative counters live in Redis).
"""
from alembic import op
import sqlalchemy as sa

revision      = "0002_security_columns"
down_revision = "0001_initial"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # Track the last time a successful login happened (useful for audit logs)
    op.add_column("users",
        sa.Column("last_login_at", sa.DateTime(), nullable=True))

    # Soft lock flag set by admin or automated abuse detection
    op.add_column("users",
        sa.Column("locked_until", sa.DateTime(), nullable=True))

    # Store which IP registered the account (fraud detection)
    op.add_column("users",
        sa.Column("registration_ip", sa.String(length=45), nullable=True))

    # Index to speed up admin searches by IP
    op.create_index("ix_users_registration_ip", "users", ["registration_ip"])

    # Add index on is_banned for fast admin filter queries
    op.create_index("ix_users_is_banned", "users", ["is_banned"])

    # Add index on created_at for daily-new-users dashboard query
    op.create_index("ix_users_created_at", "users", ["created_at"])

    # Tasks: index on created_at for dashboard
    op.create_index("ix_tasks_created_at", "tasks", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_tasks_created_at",      table_name="tasks")
    op.drop_index("ix_users_created_at",       table_name="users")
    op.drop_index("ix_users_is_banned",        table_name="users")
    op.drop_index("ix_users_registration_ip",  table_name="users")
    op.drop_column("users", "registration_ip")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "last_login_at")
