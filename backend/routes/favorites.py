"""
Favorites / Wishlist routes.

POST   /api/favorites          — add to wishlist
GET    /api/favorites          — list my favorites
DELETE /api/favorites/{id}     — remove from wishlist
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List

from ..database import get_db
from .. import models, schemas
from ..utils.auth import get_current_user

router = APIRouter(prefix="/api/favorites", tags=["Favorites"])


@router.post("", response_model=schemas.FavoriteResponse, status_code=201)
async def add_favorite(
    body: schemas.FavoriteCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    targets = [body.target_freelancer_id, body.product_id, body.task_id]
    if sum(1 for t in targets if t) != 1:
        raise HTTPException(
            status_code=400,
            detail="Specify exactly one of: target_freelancer_id, product_id, task_id"
        )

    # Prevent duplicates
    existing = db.query(models.Favorite).filter(
        models.Favorite.user_id == current_user.id,
        models.Favorite.target_freelancer_id == body.target_freelancer_id,
        models.Favorite.product_id == body.product_id,
        models.Favorite.task_id == body.task_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already in favorites")

    fav = models.Favorite(user_id=current_user.id, **body.model_dump())
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return fav


@router.get("", response_model=List[schemas.FavoriteResponse])
async def list_favorites(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Favorite)
        .filter(models.Favorite.user_id == current_user.id)
        .order_by(desc(models.Favorite.created_at))
        .all()
    )


@router.delete("/{favorite_id}", response_model=schemas.MessageResponse)
async def remove_favorite(
    favorite_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fav = db.query(models.Favorite).filter(
        models.Favorite.id == favorite_id,
        models.Favorite.user_id == current_user.id,
    ).first()
    if not fav:
        raise HTTPException(status_code=404, detail="Favorite not found")
    db.delete(fav)
    db.commit()
    return {"message": "Removed from favorites", "success": True}
