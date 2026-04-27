"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── users ──────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id",               sa.String(),  primary_key=True),
        sa.Column("email",            sa.String(),  nullable=False),
        sa.Column("hashed_password",  sa.String(),  nullable=True),
        sa.Column("full_name",        sa.String(),  nullable=False),
        sa.Column("username",         sa.String(),  nullable=True),
        sa.Column("avatar_url",       sa.String(),  nullable=True),
        sa.Column("bio",              sa.Text(),    nullable=True),
        sa.Column("skills",           sa.JSON(),    nullable=True),
        sa.Column("role",
            sa.Enum("client", "freelancer", "both", name="userrole"),
            nullable=True),
        sa.Column("is_verified",      sa.Boolean(), server_default=sa.text("false")),
        sa.Column("is_banned",        sa.Boolean(), server_default=sa.text("false")),
        sa.Column("is_google_user",   sa.Boolean(), server_default=sa.text("false")),
        sa.Column("otp_code",         sa.String(),  nullable=True),
        sa.Column("otp_expires_at",   sa.DateTime(), nullable=True),
        sa.Column("reset_code",       sa.String(),  nullable=True),
        sa.Column("reset_expires_at", sa.DateTime(), nullable=True),
        sa.Column("wallet_balance",   sa.Float(),   server_default=sa.text("0.0")),
        sa.Column("escrow_balance",   sa.Float(),   server_default=sa.text("0.0")),
        sa.Column("total_earnings",   sa.Float(),   server_default=sa.text("0.0")),
        sa.Column("created_at",       sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at",       sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email",    "users", ["email"],    unique=True)
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    # ─── admins ─────────────────────────────────────────────────────────────
    op.create_table(
        "admins",
        sa.Column("id",              sa.String(),  primary_key=True),
        sa.Column("email",           sa.String(),  nullable=False),
        sa.Column("hashed_password", sa.String(),  nullable=False),
        sa.Column("full_name",       sa.String(),  server_default="Admin"),
        sa.Column("is_super_admin",  sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at",      sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("email"),
    )

    # ─── tasks ──────────────────────────────────────────────────────────────
    op.create_table(
        "tasks",
        sa.Column("id",                  sa.String(),  primary_key=True),
        sa.Column("title",               sa.String(),  nullable=False),
        sa.Column("description",         sa.Text(),    nullable=False),
        sa.Column("category",            sa.String(),  nullable=False),
        sa.Column("budget_min",          sa.Float(),   nullable=False),
        sa.Column("budget_max",          sa.Float(),   nullable=False),
        sa.Column("deadline",            sa.DateTime(), nullable=True),
        sa.Column("location",            sa.String(),  nullable=True),
        sa.Column("tags",                sa.JSON(),    nullable=True),
        sa.Column("images",              sa.JSON(),    nullable=True),
        sa.Column("status",
            sa.Enum("open", "in_progress", "completed", "cancelled", "disputed",
                    name="taskstatus"),
            nullable=True),
        sa.Column("is_spam",             sa.Boolean(), server_default=sa.text("false")),
        sa.Column("creator_id",          sa.String(),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_to_id",      sa.String(),  sa.ForeignKey("users.id"), nullable=True),
        sa.Column("views_count",         sa.Integer(), server_default=sa.text("0")),
        sa.Column("applications_count",  sa.Integer(), server_default=sa.text("0")),
        sa.Column("created_at",          sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at",          sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_tasks_creator_id", "tasks", ["creator_id"])
    op.create_index("ix_tasks_status",     "tasks", ["status"])

    # ─── applications ───────────────────────────────────────────────────────
    op.create_table(
        "applications",
        sa.Column("id",                sa.String(),  primary_key=True),
        sa.Column("task_id",           sa.String(),  sa.ForeignKey("tasks.id"),  nullable=False),
        sa.Column("freelancer_id",     sa.String(),  sa.ForeignKey("users.id"),  nullable=False),
        sa.Column("cover_letter",      sa.Text(),    nullable=False),
        sa.Column("proposed_budget",   sa.Float(),   nullable=False),
        sa.Column("proposed_timeline", sa.String(),  nullable=True),
        sa.Column("status",
            sa.Enum("pending", "accepted", "rejected", "withdrawn",
                    name="applicationstatus"),
            nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_applications_task_id",       "applications", ["task_id"])
    op.create_index("ix_applications_freelancer_id", "applications", ["freelancer_id"])

    # ─── stores ─────────────────────────────────────────────────────────────
    op.create_table(
        "stores",
        sa.Column("id",            sa.String(),  primary_key=True),
        sa.Column("owner_id",      sa.String(),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name",          sa.String(),  nullable=False),
        sa.Column("slug",          sa.String(),  nullable=False),
        sa.Column("description",   sa.Text(),    nullable=True),
        sa.Column("logo_url",      sa.String(),  nullable=True),
        sa.Column("banner_url",    sa.String(),  nullable=True),
        sa.Column("category",      sa.String(),  nullable=True),
        sa.Column("tags",          sa.JSON(),    nullable=True),
        sa.Column("contact_email", sa.String(),  nullable=True),
        sa.Column("contact_phone", sa.String(),  nullable=True),
        sa.Column("website",       sa.String(),  nullable=True),
        sa.Column("status",
            sa.Enum("active", "suspended", "pending", name="storestatus"),
            nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("owner_id"),
        sa.UniqueConstraint("slug"),
    )

    # ─── products ───────────────────────────────────────────────────────────
    op.create_table(
        "products",
        sa.Column("id",            sa.String(),  primary_key=True),
        sa.Column("store_id",      sa.String(),  sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("title",         sa.String(),  nullable=False),
        sa.Column("description",   sa.Text(),    nullable=True),
        sa.Column("price",         sa.Float(),   nullable=False),
        sa.Column("images",        sa.JSON(),    nullable=True),
        sa.Column("category",      sa.String(),  nullable=True),
        sa.Column("is_service",    sa.Boolean(), server_default=sa.text("false")),
        sa.Column("is_active",     sa.Boolean(), server_default=sa.text("true")),
        sa.Column("delivery_time", sa.String(),  nullable=True),
        sa.Column("created_at",    sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at",    sa.DateTime(), server_default=sa.func.now()),
    )

    # ─── transactions ────────────────────────────────────────────────────────
    op.create_table(
        "transactions",
        sa.Column("id",                       sa.String(),  primary_key=True),
        sa.Column("user_id",                  sa.String(),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("task_id",                  sa.String(),  sa.ForeignKey("tasks.id"), nullable=True),
        sa.Column("type",
            sa.Enum("deposit", "withdrawal", "escrow", "release", "refund",
                    name="transactiontype"),
            nullable=False),
        sa.Column("amount",                   sa.Float(),  nullable=False),
        sa.Column("currency",                 sa.String(), server_default="USD"),
        sa.Column("status",                   sa.String(), server_default="completed"),
        sa.Column("stripe_payment_intent_id", sa.String(), nullable=True),
        sa.Column("description",              sa.String(), nullable=True),
        sa.Column("metadata",                 sa.JSON(),   nullable=True),
        sa.Column("created_at",               sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_transactions_user_id", "transactions", ["user_id"])

    # ─── notifications ───────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id",         sa.String(),  primary_key=True),
        sa.Column("user_id",    sa.String(),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type",
            sa.Enum("task_application", "application_accepted", "application_rejected",
                    "task_completed", "message", "payment", "system",
                    name="notificationtype"),
            nullable=False),
        sa.Column("title",      sa.String(), nullable=False),
        sa.Column("message",    sa.Text(),   nullable=False),
        sa.Column("is_read",    sa.Boolean(), server_default=sa.text("false")),
        sa.Column("link",       sa.String(), nullable=True),
        sa.Column("data",       sa.JSON(),   nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    # ─── conversations ───────────────────────────────────────────────────────
    op.create_table(
        "conversations",
        sa.Column("id",              sa.String(),  primary_key=True),
        sa.Column("client_id",       sa.String(),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("participant_id",  sa.String(),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("task_id",         sa.String(),  sa.ForeignKey("tasks.id"), nullable=True),
        sa.Column("last_message_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("created_at",      sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_conversations_client_id",      "conversations", ["client_id"])
    op.create_index("ix_conversations_participant_id", "conversations", ["participant_id"])

    # ─── messages ────────────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id",              sa.String(),  primary_key=True),
        sa.Column("conversation_id", sa.String(),  sa.ForeignKey("conversations.id"), nullable=False),
        sa.Column("sender_id",       sa.String(),  sa.ForeignKey("users.id"),         nullable=False),
        sa.Column("content",         sa.Text(),    nullable=False),
        sa.Column("type",
            sa.Enum("text", "image", "file", name="messagetype"),
            nullable=True),
        sa.Column("file_url",   sa.String(),  nullable=True),
        sa.Column("is_read",    sa.Boolean(), server_default=sa.text("false")),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])
    op.create_index("ix_messages_sender_id",       "messages", ["sender_id"])
    op.create_index("ix_messages_created_at",      "messages", ["created_at"])


def downgrade() -> None:
    op.drop_table("messages")
    op.drop_table("conversations")
    op.drop_table("notifications")
    op.drop_table("transactions")
    op.drop_table("products")
    op.drop_table("stores")
    op.drop_table("applications")
    op.drop_table("tasks")
    op.drop_table("admins")
    op.drop_table("users")

    # Drop enum types
    for name in [
        "userrole", "taskstatus", "applicationstatus",
        "storestatus", "transactiontype", "notificationtype", "messagetype",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {name}")
