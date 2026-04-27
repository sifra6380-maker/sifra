import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, DateTime, Text, Integer,
    Float, ForeignKey, Enum as SAEnum, JSON
)
from sqlalchemy.orm import relationship
import enum
from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


# ─────────────── ENUMS ───────────────

class UserRole(str, enum.Enum):
    client = "client"
    freelancer = "freelancer"
    store_owner = "store_owner"
    both = "both"


class AvailabilityStatus(str, enum.Enum):
    available = "available"
    busy = "busy"
    offline = "offline"


class TicketStatus(str, enum.Enum):
    open = "open"
    pending = "pending"
    resolved = "resolved"
    closed = "closed"


class TicketPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class FeedbackType(str, enum.Enum):
    suggestion = "suggestion"
    bug = "bug"
    feature = "feature"


class TaskStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    disputed = "disputed"


class DisputeStatus(str, enum.Enum):
    open = "open"
    under_review = "under_review"
    resolved_client = "resolved_client"
    resolved_freelancer = "resolved_freelancer"
    closed = "closed"


class ApplicationStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    withdrawn = "withdrawn"


class TransactionType(str, enum.Enum):
    deposit = "deposit"
    withdrawal = "withdrawal"
    escrow = "escrow"
    release = "release"
    refund = "refund"


class NotificationType(str, enum.Enum):
    task_application = "task_application"
    application_accepted = "application_accepted"
    application_rejected = "application_rejected"
    task_completed = "task_completed"
    message = "message"
    payment = "payment"
    system = "system"


class StoreStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    pending = "pending"


# ─────────────── USER ───────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=True)
    full_name = Column(String, nullable=False)
    username = Column(String, unique=True, nullable=True)
    avatar_url = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    skills = Column(JSON, default=list)
    role = Column(SAEnum(UserRole), default=UserRole.both)
    hourly_rate = Column(Float, nullable=True)
    availability = Column(SAEnum(AvailabilityStatus), default=AvailabilityStatus.available)
    last_seen = Column(DateTime, nullable=True)

    is_verified = Column(Boolean, default=False)
    is_banned = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=True)  # admin approval for freelancers
    is_google_user = Column(Boolean, default=False)

    otp_code = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)

    reset_code = Column(String, nullable=True)
    reset_expires_at = Column(DateTime, nullable=True)

    wallet_balance = Column(Float, default=0.0)
    escrow_balance = Column(Float, default=0.0)
    total_earnings = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tasks = relationship("Task", back_populates="creator", foreign_keys="Task.creator_id")
    applications = relationship("Application", back_populates="freelancer")
    store = relationship("Store", back_populates="owner", uselist=False)
    notifications = relationship("Notification", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    favorites = relationship("Favorite", back_populates="user", foreign_keys="Favorite.user_id")
    given_reviews = relationship("Review", back_populates="reviewer", foreign_keys="Review.reviewer_id")
    received_reviews = relationship("Review", back_populates="freelancer", foreign_keys="Review.freelancer_id")
    tickets = relationship("Ticket", back_populates="user")
    feedbacks = relationship("Feedback", back_populates="user")
    disputes_as_client = relationship("Dispute", back_populates="client", foreign_keys="Dispute.client_id")
    disputes_as_freelancer = relationship("Dispute", back_populates="freelancer", foreign_keys="Dispute.freelancer_id")


# ─────────────── ADMIN ───────────────

class Admin(Base):
    __tablename__ = "admins"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, default="Admin")
    is_super_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─────────────── TASK ───────────────

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False)
    budget_min = Column(Float, nullable=False)
    budget_max = Column(Float, nullable=False)
    deadline = Column(DateTime, nullable=True)
    location = Column(String, nullable=True)
    tags = Column(JSON, default=list)
    images = Column(JSON, default=list)
    status = Column(SAEnum(TaskStatus), default=TaskStatus.open)
    is_spam = Column(Boolean, default=False)

    creator_id = Column(String, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(String, ForeignKey("users.id"), nullable=True)

    views_count = Column(Integer, default=0)
    applications_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = relationship("User", back_populates="tasks", foreign_keys=[creator_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    applications = relationship("Application", back_populates="task")


# ─────────────── APPLICATION ───────────────

class Application(Base):
    __tablename__ = "applications"

    id = Column(String, primary_key=True, default=gen_uuid)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=False)
    freelancer_id = Column(String, ForeignKey("users.id"), nullable=False)

    cover_letter = Column(Text, nullable=False)
    proposed_budget = Column(Float, nullable=False)
    proposed_timeline = Column(String, nullable=True)
    status = Column(SAEnum(ApplicationStatus), default=ApplicationStatus.pending)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task = relationship("Task", back_populates="applications")
    freelancer = relationship("User", back_populates="applications")


# ─────────────── STORE ───────────────

class Store(Base):
    __tablename__ = "stores"

    id = Column(String, primary_key=True, default=gen_uuid)
    owner_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)

    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=True)
    logo_url = Column(String, nullable=True)
    banner_url = Column(String, nullable=True)
    category = Column(String, nullable=True)
    tags = Column(JSON, default=list)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    website = Column(String, nullable=True)
    status = Column(SAEnum(StoreStatus), default=StoreStatus.active)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="store")
    products = relationship("Product", back_populates="store")


# ─────────────── PRODUCT ───────────────

class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=gen_uuid)
    store_id = Column(String, ForeignKey("stores.id"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    images = Column(JSON, default=list)
    category = Column(String, nullable=True)
    is_service = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    delivery_time = Column(String, nullable=True)
    stock = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store", back_populates="products")


# ─────────────── TRANSACTION ───────────────

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=True)

    type = Column(SAEnum(TransactionType), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    status = Column(String, default="completed")

    # Commission fields
    gross_amount = Column(Float, nullable=True)
    commission_percent = Column(Float, nullable=True)
    commission_amount = Column(Float, nullable=True)
    seller_payout_amount = Column(Float, nullable=True)
    net_amount = Column(Float, nullable=True)

    razorpay_order_id = Column(String, nullable=True)
    razorpay_payment_id = Column(String, nullable=True)
    razorpay_signature = Column(String, nullable=True)
    description = Column(String, nullable=True)
    transaction_metadata = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="transactions")


# ─────────────── NOTIFICATION ───────────────

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)

    type = Column(SAEnum(NotificationType), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    link = Column(String, nullable=True)
    data = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")
    
# ─────────────── CONVERSATION ───────────────

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=gen_uuid)

    client_id = Column(String, ForeignKey("users.id"), nullable=False)
    participant_id = Column(String, ForeignKey("users.id"), nullable=False)

    task_id = Column(String, ForeignKey("tasks.id"), nullable=True)

    last_message_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("User", foreign_keys=[client_id])
    participant = relationship("User", foreign_keys=[participant_id])
    task = relationship("Task")
    messages = relationship(
        "Message",
        back_populates="conversation",
        order_by="Message.created_at",
        cascade="all, delete-orphan"
    )


# ─────────────── MESSAGE TYPE ───────────────

class MessageType(str, enum.Enum):
    text = "text"
    image = "image"
    file = "file"


# ─────────────── MESSAGE ───────────────

class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=gen_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)

    content = Column(Text, nullable=False)
    type = Column(SAEnum(MessageType), default=MessageType.text)
    file_url = Column(String, nullable=True)

    is_read = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")


# ─────────────── FAVORITE ───────────────

class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    target_freelancer_id = Column(String, ForeignKey("users.id"), nullable=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=True)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="favorites")
    target_freelancer = relationship("User", foreign_keys=[target_freelancer_id])
    product = relationship("Product")
    task = relationship("Task")


# ─────────────── REVIEW ───────────────

class Review(Base):
    __tablename__ = "reviews"

    id = Column(String, primary_key=True, default=gen_uuid)
    reviewer_id = Column(String, ForeignKey("users.id"), nullable=False)
    freelancer_id = Column(String, ForeignKey("users.id"), nullable=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=True)
    store_id = Column(String, ForeignKey("stores.id"), nullable=True)

    rating = Column(Integer, nullable=False)  # 1 to 5
    comment = Column(Text, nullable=True)
    verified_purchase = Column(Boolean, default=False)
    is_public = Column(Boolean, default=True)  # for public testimonials

    created_at = Column(DateTime, default=datetime.utcnow)

    reviewer = relationship("User", foreign_keys=[reviewer_id], back_populates="given_reviews")
    freelancer = relationship("User", foreign_keys=[freelancer_id], back_populates="received_reviews")
    product = relationship("Product")
    store = relationship("Store")


# ─────────────── TICKET ───────────────

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    subject = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(SAEnum(TicketStatus), default=TicketStatus.open)
    priority = Column(SAEnum(TicketPriority), default=TicketPriority.medium)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="tickets")
    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan")


# ─────────────── TICKET MESSAGE ───────────────

class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(String, primary_key=True, default=gen_uuid)
    ticket_id = Column(String, ForeignKey("tickets.id"), nullable=False)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)

    message = Column(Text, nullable=False)
    is_admin = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="messages")
    sender = relationship("User")


# ─────────────── FEEDBACK ───────────────

class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    
    type = Column(SAEnum(FeedbackType), nullable=False)
    rating = Column(Integer, nullable=True)  # Optional star rating 1-5
    text = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="feedbacks")


# ─────────────── PLATFORM SETTINGS ───────────────

class PlatformSettings(Base):
    __tablename__ = "platform_settings"

    id = Column(String, primary_key=True, default=gen_uuid)
    commission_enabled = Column(Boolean, default=True)
    default_commission_percent = Column(Float, default=10.0)
    freelancer_commission_percent = Column(Float, nullable=True)
    store_commission_percent = Column(Float, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─────────────── DISPUTE ───────────────

class Dispute(Base):
    __tablename__ = "disputes"

    id = Column(String, primary_key=True, default=gen_uuid)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=False)
    client_id = Column(String, ForeignKey("users.id"), nullable=False)
    freelancer_id = Column(String, ForeignKey("users.id"), nullable=False)

    reason = Column(Text, nullable=False)
    status = Column(SAEnum(DisputeStatus), default=DisputeStatus.open)
    resolution_note = Column(Text, nullable=True)
    resolved_by = Column(String, ForeignKey("admins.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task = relationship("Task")
    client = relationship("User", foreign_keys=[client_id], back_populates="disputes_as_client")
    freelancer = relationship("User", foreign_keys=[freelancer_id], back_populates="disputes_as_freelancer")
    admin_resolver = relationship("Admin")