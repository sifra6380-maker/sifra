"""
Reviews & Ratings routes.

POST /api/reviews                         — create a review
GET  /api/reviews/freelancer/{user_id}    — reviews for a freelancer
GET  /api/reviews/product/{product_id}    — reviews for a product
GET  /api/reviews/store/{store_id}        — reviews for a store
DELETE /api/reviews/{review_id}           — delete own review
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List

from ..database import get_db
from .. import models, schemas
from ..utils.auth import get_current_user

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])


def _avg(db, filter_col, filter_val):
    avg = (
        db.query(func.avg(models.Review.rating))
        .filter(filter_col == filter_val)
        .scalar()
    )
    count = (
        db.query(func.count(models.Review.id))
        .filter(filter_col == filter_val)
        .scalar()
    )
    return round(float(avg), 2) if avg else None, count


# ── Create Review ─────────────────────────────────────────────────────────────

@router.post("", response_model=schemas.ReviewResponse, status_code=201)
async def create_review(
    body: schemas.ReviewCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Must target exactly one entity
    targets = [body.freelancer_id, body.product_id, body.store_id]
    if sum(1 for t in targets if t) != 1:
        raise HTTPException(status_code=400, detail="Specify exactly one of: freelancer_id, product_id, store_id")

    # Cannot review yourself
    if body.freelancer_id and body.freelancer_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot review yourself")

    # Validate targets exist
    if body.freelancer_id:
        if not db.query(models.User).filter(models.User.id == body.freelancer_id).first():
            raise HTTPException(status_code=404, detail="Freelancer not found")
    if body.product_id:
        if not db.query(models.Product).filter(models.Product.id == body.product_id).first():
            raise HTTPException(status_code=404, detail="Product not found")
    if body.store_id:
        if not db.query(models.Store).filter(models.Store.id == body.store_id).first():
            raise HTTPException(status_code=404, detail="Store not found")

    # Prevent duplicate reviews
    existing = db.query(models.Review).filter(
        models.Review.reviewer_id == current_user.id,
        models.Review.freelancer_id == body.freelancer_id,
        models.Review.product_id == body.product_id,
        models.Review.store_id == body.store_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already reviewed this")

    review = models.Review(
        reviewer_id=current_user.id,
        **body.model_dump(),
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


# ── Get Reviews for Freelancer ────────────────────────────────────────────────

@router.get("/freelancer/{user_id}")
async def freelancer_reviews(user_id: str, db: Session = Depends(get_db)):
    reviews = (
        db.query(models.Review)
        .filter(models.Review.freelancer_id == user_id)
        .order_by(desc(models.Review.created_at))
        .all()
    )
    avg, count = _avg(db, models.Review.freelancer_id, user_id)
    return {
        "reviews": [schemas.ReviewResponse.model_validate(r) for r in reviews],
        "avg_rating": avg,
        "count": count,
    }


# ── Get Reviews for Product ───────────────────────────────────────────────────

@router.get("/product/{product_id}")
async def product_reviews(product_id: str, db: Session = Depends(get_db)):
    reviews = (
        db.query(models.Review)
        .filter(models.Review.product_id == product_id)
        .order_by(desc(models.Review.created_at))
        .all()
    )
    avg, count = _avg(db, models.Review.product_id, product_id)
    return {
        "reviews": [schemas.ReviewResponse.model_validate(r) for r in reviews],
        "avg_rating": avg,
        "count": count,
    }


# ── Get Reviews for Store ─────────────────────────────────────────────────────

@router.get("/store/{store_id}")
async def store_reviews(store_id: str, db: Session = Depends(get_db)):
    reviews = (
        db.query(models.Review)
        .filter(models.Review.store_id == store_id)
        .order_by(desc(models.Review.created_at))
        .all()
    )
    avg, count = _avg(db, models.Review.store_id, store_id)
    return {
        "reviews": [schemas.ReviewResponse.model_validate(r) for r in reviews],
        "avg_rating": avg,
        "count": count,
    }


# ── Delete own review ─────────────────────────────────────────────────────────

@router.delete("/{review_id}", response_model=schemas.MessageResponse)
async def delete_review(
    review_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.query(models.Review).filter(
        models.Review.id == review_id,
        models.Review.reviewer_id == current_user.id,
    ).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    db.delete(review)
    db.commit()
    return {"message": "Review deleted", "success": True}
