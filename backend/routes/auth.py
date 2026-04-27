"""
Authentication routes.

Rate limits (all per-IP via slowapi + Redis):
  POST /register        5/hour       — prevent account-farming
  POST /verify-email    10/minute    — OTP brute-force cap
  POST /resend-otp      3/10minutes  — email-send abuse prevention
  POST /login           10/minute    — credential stuffing prevention
  POST /google          20/minute    — OAuth abuse cap
  POST /forgot-password 5/hour       — reset-request abuse
  POST /reset-password  5/hour       — code brute-force cap
  POST /refresh         30/minute    — token refresh cap

Additional hardening:
  - OTP codes are single-use (blacklisted in Redis on first success)
  - Failed OTP attempts are counted; locked after 5 wrong tries for 1 hour
  - Failed login attempts are counted per-IP; locked after 10 tries for 15 min
  - Password-reset codes are single-use
  - Constant-time auth responses (via ConstantTimeAuthMiddleware in main.py)
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..utils.auth import (
    hash_password, verify_password,
    generate_otp, generate_reset_code,
    create_access_token, create_refresh_token, decode_refresh_token,
    get_current_user,
)
from ..utils.email import send_otp_email, send_reset_code_email
from ..utils.limiter import limiter
from ..utils.redis_client import (
    mark_otp_used, is_otp_used,
    mark_reset_code_used, is_reset_code_used,
    increment_failed_otp, get_failed_otp_count, clear_failed_otp,
    increment_failed_login, get_failed_login_count, clear_failed_login,
    OTP_MAX_ATTEMPTS, LOGIN_MAX_ATTEMPTS,
)
from ..config import settings
import httpx
import re

router = APIRouter(prefix="/api/auth", tags=["Auth"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _client_ip(request: Request) -> str:
    """Return the real client IP, honouring X-Forwarded-For when trusted."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=schemas.MessageResponse, status_code=201)
@limiter.limit(settings.RATE_REGISTER)
async def register(
    request: Request,
    body: schemas.RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    otp         = generate_otp()
    otp_expires = datetime.utcnow() + timedelta(minutes=10)

    user = models.User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        otp_code=otp,
        otp_expires_at=otp_expires,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    background_tasks.add_task(send_otp_email, user.email, otp, user.full_name)
    return {"message": "Registration successful. Check your email for the OTP.", "success": True}


# ── Verify email ──────────────────────────────────────────────────────────────

@router.post("/verify-email", response_model=schemas.TokenResponse)
@limiter.limit(settings.RATE_OTP_VERIFY)
async def verify_email(
    request: Request,
    body: schemas.VerifyEmailRequest,
    db: Session = Depends(get_db),
):
    # 1. Check per-email failed-attempt lockout
    fail_count = await get_failed_otp_count(body.email)
    if fail_count >= OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in 1 hour or request a new OTP.",
        )

    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified")

    # 2. Reject expired OTP first (saves a Redis round-trip)
    if not user.otp_code or datetime.utcnow() > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")

    # 3. Check single-use blacklist
    if await is_otp_used(body.email, body.otp):
        raise HTTPException(status_code=400, detail="OTP already used. Please request a new one.")

    # 4. Constant-time comparison
    if user.otp_code != body.otp:
        count = await increment_failed_otp(body.email)
        remaining = OTP_MAX_ATTEMPTS - count
        raise HTTPException(
            status_code=400,
            detail=f"Invalid OTP. {remaining} attempt(s) remaining.",
        )

    # 5. Success — blacklist the OTP, clear fail counter
    await mark_otp_used(body.email, body.otp, ttl_seconds=600)
    await clear_failed_otp(body.email)

    user.is_verified    = True
    user.otp_code       = None
    user.otp_expires_at = None
    db.commit()

    return {
        "access_token":  create_access_token({"sub": user.id}),
        "refresh_token": create_refresh_token({"sub": user.id}),
    }


# ── Resend OTP ────────────────────────────────────────────────────────────────

@router.post("/resend-otp", response_model=schemas.MessageResponse)
@limiter.limit(settings.RATE_OTP_RESEND)
async def resend_otp(
    request: Request,
    body: schemas.ResendOTPRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified")

    otp             = generate_otp()
    user.otp_code   = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    # Reset failed-attempt counter when a fresh OTP is issued
    await clear_failed_otp(body.email)

    background_tasks.add_task(send_otp_email, user.email, otp, user.full_name)
    return {"message": "New OTP sent to your email.", "success": True}


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=schemas.TokenResponse)
@limiter.limit(settings.RATE_LOGIN)
async def login(
    request: Request,
    body: schemas.LoginRequest,
    db: Session = Depends(get_db),
):
    ip = _client_ip(request)

    # Per-IP login lockout
    fail_count = await get_failed_login_count(ip)
    if fail_count >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Try again in 15 minutes.",
        )

    user = db.query(models.User).filter(models.User.email == body.email).first()

    # Deliberate: same error message for "not found" and "wrong password"
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        await increment_failed_login(ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Please verify your email first")
    if user.is_banned:
        raise HTTPException(status_code=403, detail="Your account has been banned")

    # Successful login — clear the fail counter
    await clear_failed_login(ip)

    return {
        "access_token":  create_access_token({"sub": user.id}),
        "refresh_token": create_refresh_token({"sub": user.id}),
    }


# ── Google OAuth ──────────────────────────────────────────────────────────────

@router.post("/google", response_model=schemas.TokenResponse)
@limiter.limit(settings.RATE_LOGIN)
async def google_login(
    request: Request,
    body: schemas.GoogleAuthRequest,
    db: Session = Depends(get_db),
):
    async with httpx.AsyncClient(timeout=10.0) as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code":          body.code,
                "client_id":     settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri":  settings.GOOGLE_REDIRECT_URI,
                "grant_type":    "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google code")

        google_access_token = token_resp.json().get("access_token")

        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {google_access_token}"},
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get Google user info")

        userinfo = userinfo_resp.json()

    email      = userinfo.get("email")
    full_name  = userinfo.get("name", "User")
    avatar_url = userinfo.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Could not get email from Google")

    # Validate email format one more time
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=400, detail="Invalid email from Google")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(
            email=email,
            full_name=full_name,
            avatar_url=avatar_url,
            is_verified=True,
            is_google_user=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif user.is_banned:
        raise HTTPException(status_code=403, detail="Your account has been banned")

    return {
        "access_token":  create_access_token({"sub": user.id}),
        "refresh_token": create_refresh_token({"sub": user.id}),
    }


# ── Token refresh ─────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=schemas.TokenResponse)
@limiter.limit("30/minute")
async def refresh_token(
    request: Request,
    body: schemas.RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    payload = decode_refresh_token(body.refresh_token)
    user_id = payload.get("sub")
    user    = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or user.is_banned:
        raise HTTPException(status_code=401, detail="User not found or banned")

    return {
        "access_token":  create_access_token({"sub": user.id}),
        "refresh_token": create_refresh_token({"sub": user.id}),
    }


# ── Forgot password ───────────────────────────────────────────────────────────

@router.post("/forgot-password", response_model=schemas.MessageResponse)
@limiter.limit(settings.RATE_FORGOT_PW)
async def forgot_password(
    request: Request,
    body: schemas.ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    # Always return success — prevents email enumeration
    if user and not user.is_google_user:
        code                  = generate_reset_code()
        user.reset_code       = code
        user.reset_expires_at = datetime.utcnow() + timedelta(minutes=15)
        db.commit()
        background_tasks.add_task(send_reset_code_email, user.email, code, user.full_name)

    return {
        "message": "If an account exists with that email, a reset code was sent.",
        "success": True,
    }


# ── Reset password ────────────────────────────────────────────────────────────

@router.post("/reset-password", response_model=schemas.MessageResponse)
@limiter.limit(settings.RATE_RESET_PW)
async def reset_password(
    request: Request,
    body: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not user.reset_code:
        raise HTTPException(status_code=400, detail="Invalid reset request")

    # Expiry check before code check (constant-time order)
    if datetime.utcnow() > user.reset_expires_at:
        raise HTTPException(status_code=400, detail="Reset code expired")

    # Single-use check
    if await is_reset_code_used(body.email, body.code):
        raise HTTPException(status_code=400, detail="Reset code already used")

    if user.reset_code != body.code:
        raise HTTPException(status_code=400, detail="Invalid reset code")

    # Blacklist the code immediately
    await mark_reset_code_used(body.email, body.code, ttl_seconds=900)

    user.hashed_password  = hash_password(body.new_password)
    user.reset_code       = None
    user.reset_expires_at = None
    db.commit()

    return {"message": "Password reset successfully. You can now login.", "success": True}


# ── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=schemas.UserPublic)
async def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user
