"""
Store & Product routes — with analytics, product update, and store orders.

Store:
  POST   /api/store/create               — create store
  GET    /api/store/me                   — my store
  PUT    /api/store/me                   — update store
  POST   /api/store/me/logo              — upload logo
  POST   /api/store/me/banner            — upload banner
  GET    /api/store/me/analytics         — store analytics
  GET    /api/store                      — list all active stores
  GET    /api/store/{slug}               — public storefront

Products:
  POST   /api/store/me/products                    — add product
  PUT    /api/store/me/products/{id}               — update product
  DELETE /api/store/me/products/{id}               — delete product
  POST   /api/store/me/products/{id}/images        — upload product images
  PUT    /api/store/me/products/{id}/stock         — update stock
  GET    /api/store/{slug}/products                — public product list for a store
"""

import re
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional
from pydantic import BaseModel, Field

from ..database import get_db
from .. import models, schemas
from ..utils.auth import get_current_user
from ..utils.cloudinary import upload_store_logo, upload_store_banner, upload_image

router = APIRouter(prefix="/api/store", tags=["Store"])


def make_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug


class StockUpdate(BaseModel):
    stock: int = Field(ge=0)


# ─────────────────────── STORE ───────────────────────────────────────────────

@router.post("/create", response_model=schemas.StoreResponse, status_code=201)
async def create_store(
    body: schemas.StoreCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.store:
        raise HTTPException(status_code=400, detail="You already have a store")

    base_slug = make_slug(body.name)
    slug = base_slug
    counter = 1
    while db.query(models.Store).filter(models.Store.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    store = models.Store(
        owner_id=current_user.id,
        slug=slug,
        **body.model_dump(),
    )
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


@router.get("/me", response_model=schemas.StoreResponse)
async def my_store(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.store:
        raise HTTPException(status_code=404, detail="You don't have a store yet")
    return current_user.store


@router.put("/me", response_model=schemas.StoreResponse)
async def update_store(
    body: schemas.StoreUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = current_user.store
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(store, key, value)

    db.commit()
    db.refresh(store)
    return store


@router.post("/me/logo", response_model=schemas.MessageResponse)
async def update_store_logo(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = current_user.store
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    url = await upload_store_logo(file)
    store.logo_url = url
    db.commit()
    return {"message": "Logo updated", "success": True}


@router.post("/me/banner", response_model=schemas.MessageResponse)
async def update_store_banner(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = current_user.store
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    url = await upload_store_banner(file)
    store.banner_url = url
    db.commit()
    return {"message": "Banner updated", "success": True}


@router.get("/me/analytics")
async def store_analytics(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Store analytics: product counts, review stats, revenue."""
    store = current_user.store
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    total_products = (
        db.query(func.count(models.Product.id))
        .filter(models.Product.store_id == store.id)
        .scalar()
    )
    active_products = (
        db.query(func.count(models.Product.id))
        .filter(models.Product.store_id == store.id, models.Product.is_active == True)
        .scalar()
    )
    avg_rating = (
        db.query(func.avg(models.Review.rating))
        .filter(models.Review.store_id == store.id)
        .scalar()
    )
    review_count = (
        db.query(func.count(models.Review.id))
        .filter(models.Review.store_id == store.id)
        .scalar()
    )
    revenue = current_user.total_earnings   # already tracked per-user

    return {
        "store_id": store.id,
        "store_name": store.name,
        "total_products": total_products,
        "active_products": active_products,
        "avg_rating": round(float(avg_rating), 2) if avg_rating else None,
        "review_count": review_count,
        "total_earnings": revenue,
        "wallet_balance": current_user.wallet_balance,
    }


@router.get("", response_model=List[schemas.StoreResponse])
async def list_stores(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=50),
    category: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Store).filter(models.Store.status == models.StoreStatus.active)
    if category:
        query = query.filter(models.Store.category == category)
    return (
        query.order_by(desc(models.Store.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )


@router.get("/{slug}", response_model=schemas.StoreResponse)
async def get_store_by_slug(slug: str, db: Session = Depends(get_db)):
    store = db.query(models.Store).filter(
        models.Store.slug == slug,
        models.Store.status == models.StoreStatus.active,
    ).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store


# ─────────────────────── PRODUCTS ────────────────────────────────────────────

@router.post("/me/products", response_model=schemas.ProductResponse, status_code=201)
async def add_product(
    body: schemas.ProductCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = current_user.store
    if not store:
        raise HTTPException(status_code=404, detail="You don't have a store")

    product = models.Product(store_id=store.id, **body.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/me/products/{product_id}", response_model=schemas.ProductResponse)
async def update_product(
    product_id: str,
    body: schemas.ProductCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product or product.store.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(product, key, value)

    db.commit()
    db.refresh(product)
    return product


@router.put("/me/products/{product_id}/stock", response_model=schemas.MessageResponse)
async def update_stock(
    product_id: str,
    body: StockUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product or product.store.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    product.stock = body.stock
    db.commit()
    return {"message": f"Stock updated to {body.stock}", "success": True}


@router.post("/me/products/{product_id}/images", response_model=schemas.MessageResponse)
async def upload_product_images(
    product_id: str,
    files: List[UploadFile] = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product or product.store.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    urls = []
    for file in files:
        url = await upload_image(file, folder="sifra/products")
        urls.append(url)

    product.images = (product.images or []) + urls
    db.commit()
    return {"message": f"Uploaded {len(urls)} image(s)", "success": True}


@router.delete("/me/products/{product_id}", response_model=schemas.MessageResponse)
async def delete_product(
    product_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product or product.store.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(product)
    db.commit()
    return {"message": "Product deleted", "success": True}


@router.get("/{slug}/products", response_model=List[schemas.ProductResponse])
async def store_products(
    slug: str,
    category: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    store = db.query(models.Store).filter(
        models.Store.slug == slug,
        models.Store.status == models.StoreStatus.active,
    ).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    query = db.query(models.Product).filter(
        models.Product.store_id == store.id,
        models.Product.is_active == True,
    )
    if category:
        query = query.filter(models.Product.category == category)

    return query.order_by(desc(models.Product.created_at)).all()
