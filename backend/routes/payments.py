"""
Payments routes — Razorpay integration.

POST  /api/payments/order               — create Razorpay order (wallet deposit)
POST  /api/payments/verify              — verify & credit wallet after payment
POST  /api/payments/checkout/{product_id} — product checkout
POST  /api/payments/webhook             — Razorpay webhook
GET   /api/payments/key                 — Razorpay key_id (public)
GET   /api/payments/history             — payment history for current user
POST  /api/payments/refund/{tx_id}      — request refund (basic)
"""

import hashlib
import hmac
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from .. import models, schemas
from ..utils.auth import get_current_user
from ..config import settings

router = APIRouter(prefix="/api/payments", tags=["Payments"])


# ── Razorpay client (lazy import so it's optional) ────────────────────────────

def _razorpay():
    try:
        import razorpay
        client = razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )
        return client
    except ImportError:
        raise HTTPException(status_code=500, detail="Razorpay SDK not installed")
    except Exception:
        raise HTTPException(status_code=500, detail="Razorpay not configured")


# ── Schemas (local, not in schemas.py to keep this self-contained) ────────────

class OrderRequest(BaseModel):
    amount: float = Field(gt=0, description="Amount in INR")


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    transaction_id: str      # internal transaction id created at order step


class ProductCheckoutRequest(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1)


# ── Create Razorpay Order (wallet deposit) ────────────────────────────────────

@router.post("/order")
async def create_order(
    body: OrderRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rz = _razorpay()
    amount_paise = int(body.amount * 100)   # Razorpay works in smallest currency unit

    order = rz.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": f"wallet_{current_user.id[:8]}",
        "notes": {"user_id": current_user.id, "type": "wallet_deposit"},
    })

    # Create a pending transaction record
    transaction = models.Transaction(
        user_id=current_user.id,
        type=models.TransactionType.deposit,
        amount=body.amount,
        currency="INR",
        status="pending",
        razorpay_order_id=order["id"],
        description=f"Wallet deposit of ₹{body.amount:.2f}",
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    return {
        "order_id": order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "key": settings.RAZORPAY_KEY_ID,
        "transaction_id": transaction.id,
    }


# ── Verify Payment & Credit Wallet ────────────────────────────────────────────

@router.post("/verify")
async def verify_payment(
    body: VerifyPaymentRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Signature verification
    message = f"{body.razorpay_order_id}|{body.razorpay_payment_id}"
    expected = hmac.new(
        key=settings.RAZORPAY_KEY_SECRET.encode(),
        msg=message.encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # 2. Find pending transaction
    tx = db.query(models.Transaction).filter(
        models.Transaction.id == body.transaction_id,
        models.Transaction.user_id == current_user.id,
        models.Transaction.status == "pending",
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found or already processed")

    # 3. Update transaction
    tx.status = "completed"
    tx.razorpay_payment_id = body.razorpay_payment_id
    tx.razorpay_signature = body.razorpay_signature

    # 4. Credit wallet
    current_user.wallet_balance += tx.amount
    db.commit()

    return {
        "success": True,
        "amount": tx.amount,
        "new_balance": current_user.wallet_balance,
    }


# ── Product Checkout ──────────────────────────────────────────────────────────

@router.post("/checkout/{product_id}")
async def product_checkout(
    product_id: str,
    body: ProductCheckoutRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.is_active == True,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    total = product.price * body.quantity

    # Fetch dynamic commission rate
    platform_settings = db.query(models.PlatformSettings).first()
    if not platform_settings:
        platform_settings = models.PlatformSettings()
        db.add(platform_settings)
        db.commit()

    commission_rate = 0.0
    if platform_settings.commission_enabled:
        commission_rate = (platform_settings.store_commission_percent or platform_settings.default_commission_percent) / 100.0

    commission = round(total * commission_rate, 2)
    seller_amount = round(total - commission, 2)

    # Deduct from buyer wallet
    if current_user.wallet_balance < total:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance. Please top up.")

    current_user.wallet_balance -= total

    # Credit seller
    store = product.store
    seller = db.query(models.User).filter(models.User.id == store.owner_id).first()
    if seller:
        seller.wallet_balance += seller_amount
        seller.total_earnings += seller_amount

    # Buyer transaction
    buyer_tx = models.Transaction(
        user_id=current_user.id,
        type=models.TransactionType.escrow,
        amount=total,
        currency="INR",
        status="completed",
        description=f"Purchase: {product.title} x{body.quantity}",
        gross_amount=total,
        commission_percent=commission_rate * 100,
        commission_amount=0,  # Buyer pays gross, no commission taken from buyer's perspective
        net_amount=total,
    )
    db.add(buyer_tx)

    # Seller transaction
    if seller:
        seller_tx = models.Transaction(
            user_id=seller.id,
            type=models.TransactionType.release,
            amount=seller_amount,
            currency="INR",
            status="completed",
            description=f"Sale: {product.title} x{body.quantity} (commission deducted)",
            gross_amount=total,
            commission_percent=commission_rate * 100,
            commission_amount=commission,
            seller_payout_amount=seller_amount,
            net_amount=seller_amount,
        )
        db.add(seller_tx)

    db.commit()

    return {
        "success": True,
        "product": product.title,
        "quantity": body.quantity,
        "total_charged": total,
        "commission": commission,
        "seller_credited": seller_amount,
        "new_balance": current_user.wallet_balance,
    }


# ── Razorpay Webhook ──────────────────────────────────────────────────────────

@router.post("/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """Verify and handle Razorpay webhook events."""
    payload = await request.body()
    sig = request.headers.get("X-Razorpay-Signature", "")

    if settings.RAZORPAY_WEBHOOK_SECRET:
        expected = hmac.new(
            key=settings.RAZORPAY_WEBHOOK_SECRET.encode(),
            msg=payload,
            digestmod=hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, sig):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    import json
    data = json.loads(payload)
    event = data.get("event", "")

    if event == "payment.captured":
        # Already handled via /verify, but handle as fallback
        payment = data.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = payment.get("order_id")
        payment_id = payment.get("id")

        if order_id and payment_id:
            tx = db.query(models.Transaction).filter(
                models.Transaction.razorpay_order_id == order_id,
                models.Transaction.status == "pending",
            ).first()
            if tx:
                tx.status = "completed"
                tx.razorpay_payment_id = payment_id
                user = db.query(models.User).filter(models.User.id == tx.user_id).first()
                if user:
                    user.wallet_balance += tx.amount
                db.commit()

    return {"status": "ok"}


# ── Payment Key ───────────────────────────────────────────────────────────────

@router.get("/key")
async def get_key():
    return {"key_id": settings.RAZORPAY_KEY_ID}


# ── Payment History ───────────────────────────────────────────────────────────

@router.get("/history")
async def payment_history(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id == current_user.id)
        .order_by(models.Transaction.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "transactions": [schemas.TransactionResponse.model_validate(t) for t in transactions],
        "wallet_balance": current_user.wallet_balance,
        "total_earnings": current_user.total_earnings,
    }


# ── Refund (Basic) ────────────────────────────────────────────────────────────

@router.post("/refund/{tx_id}")
async def request_refund(
    tx_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tx = db.query(models.Transaction).filter(
        models.Transaction.id == tx_id,
        models.Transaction.user_id == current_user.id,
        models.Transaction.status == "completed",
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found or not eligible for refund")

    if tx.type not in (models.TransactionType.deposit, models.TransactionType.escrow):
        raise HTTPException(status_code=400, detail="This transaction type cannot be refunded")

    rz = _razorpay()
    try:
        if tx.razorpay_payment_id:
            rz.payment.refund(tx.razorpay_payment_id, {
                "amount": int(tx.amount * 100),
                "notes": {"reason": "User requested refund", "user_id": current_user.id},
            })

        # Record refund transaction
        refund_tx = models.Transaction(
            user_id=current_user.id,
            type=models.TransactionType.refund,
            amount=tx.amount,
            currency=tx.currency,
            status="completed",
            description=f"Refund for transaction {tx.id}",
        )
        db.add(refund_tx)
        current_user.wallet_balance += tx.amount   # credit back
        tx.status = "refunded"
        db.commit()

        return {"success": True, "refunded_amount": tx.amount}

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Refund failed: {str(e)}")
