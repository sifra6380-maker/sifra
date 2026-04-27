from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Any, Dict
from datetime import datetime
from .models import UserRole, TaskStatus, ApplicationStatus, StoreStatus, TransactionType, NotificationType, AvailabilityStatus, TicketStatus, TicketPriority, FeedbackType, DisputeStatus


# ─────────────── AUTH SCHEMAS ───────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=100)
    role: UserRole = UserRole.both


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    code: str


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str


class ResendOTPRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ─────────────── USER SCHEMAS ───────────────

class UserPublic(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    username: Optional[str]
    avatar_url: Optional[str]
    bio: Optional[str]
    skills: List[str] = []
    role: UserRole
    is_verified: bool
    hourly_rate: Optional[float] = None
    availability: AvailabilityStatus
    last_seen: Optional[datetime] = None
    wallet_balance: float
    total_earnings: float
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[List[str]] = None
    role: Optional[UserRole] = None
    hourly_rate: Optional[float] = None
    availability: Optional[AvailabilityStatus] = None


class AdminUserView(UserPublic):
    is_banned: bool
    is_approved: bool
    is_google_user: bool


# ─────────────── TASK SCHEMAS ───────────────

class TaskCreate(BaseModel):
    title: str = Field(min_length=10, max_length=200)
    description: str = Field(min_length=30)
    category: str
    budget_min: float = Field(gt=0)
    budget_max: float = Field(gt=0)
    deadline: Optional[datetime] = None
    location: Optional[str] = None
    tags: List[str] = []

    @validator("budget_max")
    def max_gte_min(cls, v, values):
        if "budget_min" in values and v < values["budget_min"]:
            raise ValueError("budget_max must be >= budget_min")
        return v


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    deadline: Optional[datetime] = None
    location: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[TaskStatus] = None


class TaskResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    budget_min: float
    budget_max: float
    deadline: Optional[datetime]
    location: Optional[str]
    tags: List[str] = []
    images: List[str] = []
    status: TaskStatus
    creator_id: str
    creator: Optional[UserPublic]
    views_count: int
    applications_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    tasks: List[TaskResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ─────────────── APPLICATION SCHEMAS ───────────────

class ApplicationCreate(BaseModel):
    cover_letter: str = Field(min_length=50)
    proposed_budget: float = Field(gt=0)
    proposed_timeline: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: str
    task_id: str
    freelancer_id: str
    freelancer: Optional[UserPublic]
    task: Optional[TaskResponse]
    cover_letter: str
    proposed_budget: float
    proposed_timeline: Optional[str]
    status: ApplicationStatus
    created_at: datetime

    class Config:
        from_attributes = True


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus


# ─────────────── STORE SCHEMAS ───────────────

class StoreCreate(BaseModel):
    name: str = Field(min_length=3, max_length=100)
    description: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None


class StoreUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None


class ProductCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: Optional[str] = None
    price: float = Field(gt=0)
    category: Optional[str] = None
    is_service: bool = False
    delivery_time: Optional[str] = None
    stock: int = Field(default=0, ge=0)


class ProductResponse(BaseModel):
    id: str
    store_id: str
    title: str
    description: Optional[str]
    price: float
    images: List[str] = []
    category: Optional[str]
    is_service: bool
    is_active: bool
    delivery_time: Optional[str]
    stock: int
    created_at: datetime

    class Config:
        from_attributes = True


class StoreResponse(BaseModel):
    id: str
    owner_id: str
    owner: Optional[UserPublic]
    name: str
    slug: str
    description: Optional[str]
    logo_url: Optional[str]
    banner_url: Optional[str]
    category: Optional[str]
    tags: List[str] = []
    contact_email: Optional[str]
    contact_phone: Optional[str]
    website: Optional[str]
    status: StoreStatus
    products: List[ProductResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────── NOTIFICATION SCHEMAS ───────────────

class NotificationResponse(BaseModel):
    id: str
    type: NotificationType
    title: str
    message: str
    is_read: bool
    link: Optional[str]
    data: Dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────── TRANSACTION SCHEMAS ───────────────

class TransactionResponse(BaseModel):
    id: str
    type: TransactionType
    amount: float
    currency: str
    status: str
    
    # Commission fields
    gross_amount: Optional[float] = None
    commission_percent: Optional[float] = None
    commission_amount: Optional[float] = None
    seller_payout_amount: Optional[float] = None
    net_amount: Optional[float] = None

    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────── ADMIN SCHEMAS ───────────────

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str
    secret_key: str


class AdminDashboardStats(BaseModel):
    total_users: int
    total_tasks: int
    total_stores: int
    total_applications: int
    total_transactions_volume: float
    platform_earnings: float
    pending_payouts: float
    new_users_today: int
    new_tasks_today: int
    open_tasks: int
    banned_users: int

class PlatformSettingsUpdate(BaseModel):
    commission_enabled: Optional[bool] = None
    default_commission_percent: Optional[float] = None
    freelancer_commission_percent: Optional[float] = None
    store_commission_percent: Optional[float] = None

class PlatformSettingsResponse(BaseModel):
    id: str
    commission_enabled: bool
    default_commission_percent: float
    freelancer_commission_percent: Optional[float] = None
    store_commission_percent: Optional[float] = None
    updated_at: datetime

    class Config:
        from_attributes = True


# ─────────────── WALLET SCHEMAS ───────────────

class WalletDepositRequest(BaseModel):
    amount: float = Field(gt=0)
    payment_method_id: str  # Stripe payment method ID


class WalletResponse(BaseModel):
    balance: float
    escrow_balance: float
    total_earnings: float
    transactions: List[TransactionResponse] = []


# ─────────────── GENERIC ───────────────

class MessageResponse(BaseModel):
    message: str
    success: bool = True


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)


# ─────────────── CHAT SCHEMAS ───────────────

class ConversationCreate(BaseModel):
    participant_id: str
    task_id: Optional[str] = None
    opening_message: str = Field(min_length=1, max_length=2000)


class ChatMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    type: str = "text"   # text | image | file


class ChatMessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender: Optional["UserPublic"]
    content: str
    type: str
    file_url: Optional[str]
    is_read: bool
    is_deleted: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: str
    client_id: str
    participant_id: str
    client: Optional["UserPublic"]
    participant: Optional["UserPublic"]
    task_id: Optional[str]
    task: Optional["TaskResponse"]
    last_message_at: datetime
    created_at: datetime
    messages: List[ChatMessageResponse] = []
    unread_count: int = 0   # computed

    class Config:
        from_attributes = True


# ─────────────── FAVORITE SCHEMAS ───────────────

class FavoriteCreate(BaseModel):
    target_freelancer_id: Optional[str] = None
    product_id: Optional[str] = None
    task_id: Optional[str] = None


class FavoriteResponse(BaseModel):
    id: str
    user_id: str
    target_freelancer_id: Optional[str]
    product_id: Optional[str]
    task_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────── REVIEW SCHEMAS ───────────────

class ReviewCreate(BaseModel):
    freelancer_id: Optional[str] = None
    product_id: Optional[str] = None
    store_id: Optional[str] = None
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: str
    reviewer_id: str
    freelancer_id: Optional[str]
    product_id: Optional[str]
    store_id: Optional[str]
    rating: int
    comment: Optional[str]
    verified_purchase: bool = False
    is_public: bool = True
    reviewer: Optional[UserPublic]
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────── TICKET SCHEMAS ───────────────

class TicketCreate(BaseModel):
    subject: str = Field(min_length=5, max_length=150)
    description: str = Field(min_length=20)
    priority: TicketPriority = TicketPriority.medium


class TicketUpdate(BaseModel):
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None


class TicketResponse(BaseModel):
    id: str
    user_id: str
    subject: str
    description: str
    status: TicketStatus
    priority: TicketPriority
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TicketMessageCreate(BaseModel):
    message: str = Field(min_length=1)


class TicketMessageResponse(BaseModel):
    id: str
    ticket_id: str
    sender_id: str
    message: str
    is_admin: bool
    created_at: datetime
    sender: Optional[UserPublic]

    class Config:
        from_attributes = True


# ─────────────── FEEDBACK SCHEMAS ───────────────

class FeedbackCreate(BaseModel):
    type: FeedbackType
    rating: Optional[int] = Field(None, ge=1, le=5)
    text: str = Field(min_length=10)


class FeedbackResponse(BaseModel):
    id: str
    user_id: Optional[str]
    type: FeedbackType
    rating: Optional[int]
    text: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────── DISPUTE SCHEMAS ───────────────

class DisputeCreate(BaseModel):
    task_id: str
    freelancer_id: str
    reason: str = Field(min_length=20)


class DisputeResolve(BaseModel):
    status: DisputeStatus
    resolution_note: Optional[str] = None


class DisputeResponse(BaseModel):
    id: str
    task_id: str
    client_id: str
    freelancer_id: str
    reason: str
    status: DisputeStatus
    resolution_note: Optional[str]
    resolved_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
