"""
Platform Feedback routes.

POST  /api/feedback             — submit feedback (auth optional)
GET   /api/feedback             — list own feedback (authenticated)
GET   /api/feedback/admin/all   — all feedback (admin)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List

from ..database import get_db
from .. import models, schemas
from ..utils.auth import get_current_user, get_current_admin
from fastapi.security import OAuth2PasswordBearer
from fastapi import Request

router = APIRouter(prefix="/api/feedback", tags=["Feedback"])


# ── Submit Feedback (no auth required) ────────────────────────────────────────

@router.post("", response_model=schemas.FeedbackResponse, status_code=201)
async def submit_feedback(
    body: schemas.FeedbackCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Anyone can submit feedback — auth is optional."""
    # Try to get user from token if present
    user_id = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        from ..utils.auth import decode_access_token
        try:
            payload = decode_access_token(auth_header.split(" ")[1])
            user_id = payload.get("sub")
        except Exception:
            pass

    feedback = models.Feedback(
        user_id=user_id,
        type=body.type,
        rating=body.rating,
        text=body.text,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


# ── List own feedback ─────────────────────────────────────────────────────────

@router.get("", response_model=List[schemas.FeedbackResponse])
async def list_my_feedback(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Feedback)
        .filter(models.Feedback.user_id == current_user.id)
        .order_by(desc(models.Feedback.created_at))
        .all()
    )


# ── Public testimonials (no auth) ─────────────────────────────────────────

@router.get("/testimonials")
async def public_testimonials(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """High-rated feedback for public display. Only shows 4-5 star with user info."""
    items = (
        db.query(models.Feedback)
        .filter(
            models.Feedback.rating >= 4,
            models.Feedback.user_id.isnot(None),
        )
        .order_by(desc(models.Feedback.created_at))
        .limit(limit)
        .all()
    )
    results = []
    for f in items:
        user = db.query(models.User).filter(models.User.id == f.user_id).first()
        results.append({
            "id": f.id,
            "rating": f.rating,
            "text": f.text,
            "type": f.type.value,
            "user_name": user.full_name if user else "Anonymous",
            "user_avatar": user.avatar_url if user else None,
            "created_at": f.created_at.isoformat(),
        })
    return {"testimonials": results}


# ── Admin: list all feedback ──────────────────────────────────────────────────

@router.get("/admin/all")
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
    return {
        "feedback": [schemas.FeedbackResponse.model_validate(f) for f in items],
        "total": total,
    }
