"""
User profile, wallet, order tracking, and public profile routes.

GET   /api/users/me                     — own profile
PUT   /api/users/me                     — update profile
POST  /api/users/me/avatar              — upload avatar
GET   /api/users/me/wallet              — wallet + transactions
GET   /api/users/me/orders              — order history (tasks assigned to me or created by me)
GET   /api/users/{user_id}              — public profile
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from typing import List

from ..database import get_db
from .. import models, schemas
from ..utils.auth import get_current_user
from ..utils.cloudinary import upload_avatar

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me", response_model=schemas.UserPublic)
async def get_profile(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=schemas.UserPublic)
async def update_profile(
    body: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.username and body.username != current_user.username:
        existing = (
            db.query(models.User)
            .filter(models.User.username == body.username)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(current_user, key, value)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=schemas.MessageResponse)
async def update_avatar(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    url = await upload_avatar(file)
    current_user.avatar_url = url
    db.commit()
    return {"message": "Avatar updated", "success": True}


@router.get("/me/wallet", response_model=schemas.WalletResponse)
async def get_wallet(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id == current_user.id)
        .order_by(models.Transaction.created_at.desc())
        .limit(20)
        .all()
    )
    return {
        "balance": current_user.wallet_balance,
        "escrow_balance": current_user.escrow_balance,
        "total_earnings": current_user.total_earnings,
        "transactions": transactions,
    }


@router.get("/me/orders")
async def get_my_orders(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Orders dashboard — tasks the user created (as client) or is assigned to (as freelancer).
    """
    query = db.query(models.Task).filter(
        or_(
            models.Task.creator_id == current_user.id,
            models.Task.assigned_to_id == current_user.id,
        )
    )
    total = query.count()
    tasks = (
        query.order_by(desc(models.Task.updated_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {
        "orders": [schemas.TaskResponse.model_validate(t) for t in tasks],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.get("/me/earnings")
async def get_earnings_dashboard(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Earnings dashboard for freelancers."""
    releases = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.user_id == current_user.id,
            models.Transaction.type == models.TransactionType.release,
            models.Transaction.status == "completed",
        )
        .order_by(models.Transaction.created_at.desc())
        .limit(50)
        .all()
    )
    
    from sqlalchemy import func
    
    gross_sales = db.query(func.sum(models.Transaction.gross_amount)).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.type == models.TransactionType.release,
        models.Transaction.status == "completed",
    ).scalar() or 0.0

    total_commission = db.query(func.sum(models.Transaction.commission_amount)).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.type == models.TransactionType.release,
        models.Transaction.status == "completed",
    ).scalar() or 0.0

    return {
        "gross_sales": float(gross_sales),
        "total_commission_deducted": float(total_commission),
        "net_earnings": current_user.total_earnings,
        "wallet_balance": current_user.wallet_balance,
        "recent_payouts": [schemas.TransactionResponse.model_validate(t) for t in releases],
    }


@router.get("/{user_id}", response_model=schemas.UserPublic)
async def get_user_profile(user_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.is_banned == False,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
