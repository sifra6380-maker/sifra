"""
Freelancer discovery & public profile routes.

GET  /api/freelancers            — paginated list with filters
GET  /api/freelancers/{user_id}  — public profile
PUT  /api/freelancers/me         — update freelancer-specific fields (availability, hourly_rate)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, desc
from typing import Optional, List

from ..database import get_db
from .. import models, schemas
from ..utils.auth import get_current_user

router = APIRouter(prefix="/api/freelancers", tags=["Freelancers"])


# ── Public: List / Search ─────────────────────────────────────────────────────

@router.get("", response_model=dict)
async def list_freelancers(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=100),
    skill: Optional[str] = Query(default=None, max_length=60),
    min_rate: Optional[float] = Query(default=None, ge=0),
    max_rate: Optional[float] = Query(default=None, ge=0),
    availability: Optional[str] = Query(default=None),
    min_rating: Optional[float] = Query(default=None, ge=1, le=5),
    db: Session = Depends(get_db),
):
    """Browse & filter freelancers."""
    query = db.query(models.User).filter(
        models.User.role.in_([models.UserRole.freelancer, models.UserRole.both]),
        models.User.is_verified == True,
        models.User.is_banned == False,
    )

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.User.full_name.ilike(term),
                models.User.bio.ilike(term),
            )
        )

    if skill:
        # Skills stored as JSON array — use LIKE on the JSON text
        query = query.filter(
            models.User.skills.cast(models.String).ilike(f"%{skill}%")
        )

    if min_rate is not None:
        query = query.filter(models.User.hourly_rate >= min_rate)
    if max_rate is not None:
        query = query.filter(models.User.hourly_rate <= max_rate)

    if availability:
        try:
            avail_enum = models.AvailabilityStatus(availability)
            query = query.filter(models.User.availability == avail_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid availability value")

    total = query.count()

    # If min_rating filter requested, compute average ratings per user
    # We do a sub-select approach
    if min_rating is not None:
        rated_ids = (
            db.query(models.Review.freelancer_id)
            .group_by(models.Review.freelancer_id)
            .having(func.avg(models.Review.rating) >= min_rating)
            .subquery()
        )
        query = query.filter(models.User.id.in_(rated_ids))
        total = query.count()

    users = (
        query
        .order_by(desc(models.User.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "freelancers": [schemas.UserPublic.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


# ── Public: Single Profile ────────────────────────────────────────────────────

@router.get("/{user_id}", response_model=dict)
async def get_freelancer_profile(user_id: str, db: Session = Depends(get_db)):
    """Public freelancer profile with reviews & average rating."""
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.is_banned == False,
        models.User.is_verified == True,
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="Freelancer not found")

    # Reviews for this freelancer
    reviews = (
        db.query(models.Review)
        .filter(models.Review.freelancer_id == user_id)
        .order_by(desc(models.Review.created_at))
        .limit(20)
        .all()
    )

    avg_rating = (
        db.query(func.avg(models.Review.rating))
        .filter(models.Review.freelancer_id == user_id)
        .scalar()
    )

    return {
        "profile": schemas.UserPublic.model_validate(user),
        "reviews": [schemas.ReviewResponse.model_validate(r) for r in reviews],
        "avg_rating": round(float(avg_rating), 2) if avg_rating else None,
        "review_count": len(reviews),
    }


# ── Authenticated: Update own freelancer settings ─────────────────────────────

@router.put("/me/settings", response_model=schemas.UserPublic)
async def update_freelancer_settings(
    body: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update availability, hourly_rate, skills, bio."""
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user
