"""
Admin panel routes.

Auth & Dashboard:
  POST  /api/admin/login
  GET   /api/admin/dashboard

User management:
  GET   /api/admin/users
  PUT   /api/admin/users/{id}/ban
  PUT   /api/admin/users/{id}/unban
  DELETE /api/admin/users/{id}
  PUT   /api/admin/users/{id}/verify

Task management:
  GET   /api/admin/tasks
  DELETE /api/admin/tasks/{id}
  PUT   /api/admin/tasks/{id}/spam

Store management:
  GET   /api/admin/stores
  PUT   /api/admin/stores/{id}/suspend
  PUT   /api/admin/stores/{id}/approve
  DELETE /api/admin/stores/{id}

Ticket management:
  GET   /api/admin/tickets
  PUT   /api/admin/tickets/{id}
  POST  /api/admin/tickets/{id}/reply

Feedback management:
  GET   /api/admin/feedback
  DELETE /api/admin/feedback/{id}

Reports & Analytics:
  GET   /api/admin/reports

Dispute Management:
  GET   /api/admin/disputes
  PUT   /api/admin/disputes/{id}/resolve

User Approval:
  PUT   /api/admin/users/{id}/approve
  PUT   /api/admin/users/{id}/reject
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional

from ..database import get_db
from .. import models, schemas
from ..utils.auth import hash_password, verify_password, get_current_admin, create_access_token
from ..utils.limiter import limiter
from ..utils.sanitize import sanitize_search, safe_like
from ..config import settings

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ── Auth ──────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=schemas.TokenResponse)
@limiter.limit(settings.RATE_ADMIN_LOGIN)
async def admin_login(
    request: Request,
    body: schemas.AdminLoginRequest,
    db: Session = Depends(get_db),
):
    if body.secret_key != settings.ADMIN_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin secret key")

    admin = db.query(models.Admin).filter(models.Admin.email == body.email).first()
    if not admin or not verify_password(body.password, admin.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(
        {"sub": admin.id, "role": "admin"},
        expires_delta=timedelta(hours=24),
    )
    return {"access_token": access_token, "refresh_token": access_token}


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=schemas.AdminDashboardStats)
async def dashboard(
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    return {
        "total_users": db.query(func.count(models.User.id)).scalar(),
        "total_tasks": db.query(func.count(models.Task.id)).scalar(),
        "total_stores": db.query(func.count(models.Store.id)).scalar(),
        "total_applications": db.query(func.count(models.Application.id)).scalar(),
        "total_transactions_volume": float(
            db.query(func.sum(models.Transaction.amount)).scalar() or 0.0
        ),
        "platform_earnings": float(
            db.query(func.sum(models.Transaction.commission_amount)).scalar() or 0.0
        ),
        "pending_payouts": float(
            db.query(func.sum(models.User.wallet_balance)).scalar() or 0.0
        ),
        "new_users_today": db.query(func.count(models.User.id))
            .filter(models.User.created_at >= today_start).scalar(),
        "new_tasks_today": db.query(func.count(models.Task.id))
            .filter(models.Task.created_at >= today_start).scalar(),
        "open_tasks": db.query(func.count(models.Task.id))
            .filter(models.Task.status == models.TaskStatus.open).scalar(),
        "banned_users": db.query(func.count(models.User.id))
            .filter(models.User.is_banned == True).scalar(),
    }


# ── Commission Settings ───────────────────────────────────────────────────────

@router.get("/commission-settings", response_model=schemas.PlatformSettingsResponse)
async def get_commission_settings(
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    settings = db.query(models.PlatformSettings).first()
    if not settings:
        settings = models.PlatformSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put("/commission-settings", response_model=schemas.PlatformSettingsResponse)
async def update_commission_settings(
    body: schemas.PlatformSettingsUpdate,
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    settings = db.query(models.PlatformSettings).first()
    if not settings:
        settings = models.PlatformSettings()
        db.add(settings)
    
    update_data = body.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)
        
    db.commit()
    db.refresh(settings)
    return settings


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.User)
    if search:
        safe = safe_like(sanitize_search(search, max_length=100))
        query = query.filter(
            models.User.email.ilike(f"%{safe}%", escape="\\") |
            models.User.full_name.ilike(f"%{safe}%", escape="\\")
        )
    if role:
        query = query.filter(models.User.role == role)

    total = query.count()
    users = (
        query.order_by(desc(models.User.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {"users": [schemas.AdminUserView.model_validate(u) for u in users], "total": total, "page": page, "per_page": per_page}


@router.put("/users/{user_id}/ban")
async def ban_user(user_id: str, admin: models.Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_banned = True
    db.commit()
    return {"message": f"User {user.email} banned", "success": True}


@router.put("/users/{user_id}/unban")
async def unban_user(user_id: str, admin: models.Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_banned = False
    db.commit()
    return {"message": f"User {user.email} unbanned", "success": True}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: models.Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted", "success": True}


@router.put("/users/{user_id}/verify")
async def verify_user(user_id: str, admin: models.Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_verified = True
    db.commit()
    return {"message": "User verified", "success": True}


@router.put("/users/{user_id}/approve")
async def approve_user(user_id: str, admin: models.Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_approved = True
    db.commit()
    return {"message": f"User {user.email} approved", "success": True}


@router.put("/users/{user_id}/reject")
async def reject_user(user_id: str, admin: models.Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_approved = False
    db.commit()
    return {"message": f"User {user.email} rejected", "success": True}


# ── Tasks ─────────────────────────────────────────────────────────────────────

@router.get("/tasks")
async def admin_list_tasks(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.Task)
    total = query.count()
    tasks = (
        query.order_by(desc(models.Task.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {"tasks": [schemas.TaskResponse.model_validate(t) for t in tasks], "total": total}


@router.delete("/tasks/{task_id}")
async def admin_delete_task(task_id: str, admin: models.Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"message": "Task deleted", "success": True}


@router.put("/tasks/{task_id}/spam")
async def mark_spam(task_id: str, admin: models.Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_spam = True
    db.commit()
    return {"message": "Task marked as spam", "success": True}


# ── Stores ────────────────────────────────────────────────────────────────────

@router.get("/stores")
async def admin_list_stores(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.Store)
    if status:
        query = query.filter(models.Store.status == status)
    total = query.count()
    stores = (
        query.order_by(desc(models.Store.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {"stores": [schemas.StoreResponse.model_validate(s) for s in stores], "total": total}


@router.put("/stores/{store_id}/suspend")
async def suspend_store(store_id: str, admin: models.Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    store = db.query(models.Store).filter(models.Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    store.status = models.StoreStatus.suspended
    db.commit()
    return {"message": "Store suspended", "success": True}


@router.put("/stores/{store_id}/approve")
async def approve_store(store_id: str, admin: models.Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    store = db.query(models.Store).filter(models.Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    store.status = models.StoreStatus.active
    db.commit()
    return {"message": "Store approved", "success": True}


@router.delete("/stores/{store_id}")
async def admin_delete_store(store_id: str, admin: models.Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    store = db.query(models.Store).filter(models.Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    db.delete(store)
    db.commit()
    return {"message": "Store deleted", "success": True}


# ── Tickets ───────────────────────────────────────────────────────────────────

@router.get("/tickets")
async def admin_list_tickets(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.Ticket)
    if status:
        query = query.filter(models.Ticket.status == status)
    if priority:
        query = query.filter(models.Ticket.priority == priority)
    total = query.count()
    tickets = (
        query.order_by(desc(models.Ticket.updated_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {"tickets": [schemas.TicketResponse.model_validate(t) for t in tickets], "total": total}


@router.put("/tickets/{ticket_id}")
async def admin_update_ticket(
    ticket_id: str,
    body: schemas.TicketUpdate,
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(ticket, key, value)
    db.commit()
    db.refresh(ticket)
    return schemas.TicketResponse.model_validate(ticket)


@router.post("/tickets/{ticket_id}/reply", response_model=schemas.TicketMessageResponse, status_code=201)
async def admin_reply_ticket(
    ticket_id: str,
    body: schemas.TicketMessageCreate,
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    msg = models.TicketMessage(
        ticket_id=ticket_id,
        sender_id=admin.id,
        message=body.message,
        is_admin=True,
    )
    db.add(msg)
    ticket.status = models.TicketStatus.open
    db.commit()
    db.refresh(msg)
    return msg


# ── Feedback ──────────────────────────────────────────────────────────────────

@router.get("/feedback")
async def admin_list_feedback(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=30, ge=1, le=100),
    type: Optional[str] = Query(default=None),
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.Feedback)
    if type:
        query = query.filter(models.Feedback.type == type)
    total = query.count()
    items = (
        query.order_by(desc(models.Feedback.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {"feedback": [schemas.FeedbackResponse.model_validate(f) for f in items], "total": total}


@router.delete("/feedback/{feedback_id}")
async def delete_feedback(
    feedback_id: str,
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    fb = db.query(models.Feedback).filter(models.Feedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    db.delete(fb)
    db.commit()
    return {"message": "Feedback deleted", "success": True}


# ── Reports ───────────────────────────────────────────────────────────────────

@router.get("/reports")
async def reports(
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Platform-wide analytics report."""
    total_revenue = float(
        db.query(func.sum(models.Transaction.amount))
        .filter(models.Transaction.status == "completed")
        .scalar() or 0
    )
    open_tickets = db.query(func.count(models.Ticket.id)).filter(
        models.Ticket.status.in_([models.TicketStatus.open, models.TicketStatus.pending])
    ).scalar()
    total_reviews = db.query(func.count(models.Review.id)).scalar()
    avg_platform_rating = float(
        db.query(func.avg(models.Review.rating)).scalar() or 0
    )
    total_feedback = db.query(func.count(models.Feedback.id)).scalar()

    return {
        "total_revenue_inr": total_revenue,
        "open_support_tickets": open_tickets,
        "total_reviews": total_reviews,
        "avg_platform_rating": round(avg_platform_rating, 2),
        "total_feedback_submissions": total_feedback,
        "total_disputes": db.query(func.count(models.Dispute.id)).scalar(),
        "open_disputes": db.query(func.count(models.Dispute.id)).filter(
            models.Dispute.status.in_([models.DisputeStatus.open, models.DisputeStatus.under_review])
        ).scalar(),
        "resolved_disputes": db.query(func.count(models.Dispute.id)).filter(
            models.Dispute.status.in_([models.DisputeStatus.resolved_client, models.DisputeStatus.resolved_freelancer, models.DisputeStatus.closed])
        ).scalar(),
        "pending_approvals": db.query(func.count(models.User.id)).filter(models.User.is_approved == False).scalar(),
        "total_products": db.query(func.count(models.Product.id)).scalar(),
        "freelancer_count": db.query(func.count(models.User.id)).filter(
            models.User.role.in_([models.UserRole.freelancer, models.UserRole.both])
        ).scalar(),
    }


# ── Disputes ────────────────────────────────────────────────────────────────────

@router.get("/disputes")
async def admin_list_disputes(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.Dispute)
    if status:
        query = query.filter(models.Dispute.status == status)
    total = query.count()
    disputes = (
        query.order_by(desc(models.Dispute.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {"disputes": [schemas.DisputeResponse.model_validate(d) for d in disputes], "total": total}


@router.put("/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: str,
    body: schemas.DisputeResolve,
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    dispute = db.query(models.Dispute).filter(models.Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    dispute.status = body.status
    dispute.resolution_note = body.resolution_note
    dispute.resolved_by = admin.id
    db.commit()
    db.refresh(dispute)
    return schemas.DisputeResponse.model_validate(dispute)
