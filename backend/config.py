from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str
    JWT_REFRESH_SECRET: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Admin ─────────────────────────────────────────────────────────────────
    ADMIN_SECRET_KEY: str
    ADMIN_EMAIL: str = "admin@sifra.com"
    ADMIN_PASSWORD: str

    # ── Email ─────────────────────────────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str
    SMTP_PASSWORD: str
    EMAIL_FROM: str
    EMAIL_FROM_NAME: str = "Sifra"

    # ── Google OAuth ──────────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str = "http://localhost:5173/auth/google/callback"

    # ── Cloudinary ────────────────────────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str

    # ── Razorpay ───────────────────────────────────────────────────────────────
    RAZORPAY_KEY_ID: str = "rzp_test_placeholder"
    RAZORPAY_KEY_SECRET: str = "placeholder"
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── App ───────────────────────────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"
    ENVIRONMENT: str = "development"       # development | staging | production

    # ── Rate-limit knobs (requests / window) ──────────────────────────────────
    # These can be overridden in .env without touching code.
    RATE_REGISTER:      str = "5/hour"      # new account creation per IP
    RATE_LOGIN:         str = "10/minute"   # login attempts per IP
    RATE_OTP_VERIFY:    str = "10/minute"   # OTP verification per IP
    RATE_OTP_RESEND:    str = "3/10minutes" # OTP resend per IP
    RATE_FORGOT_PW:     str = "5/hour"      # password-reset requests per IP
    RATE_RESET_PW:      str = "5/hour"      # password-reset submissions per IP
    RATE_ADMIN_LOGIN:   str = "5/minute"    # admin login per IP
    RATE_TASK_CREATE:   str = "20/hour"     # new task creation per user
    RATE_APPLY:         str = "30/hour"     # job applications per user
    RATE_CHAT_MSG:      str = "60/minute"   # chat messages per user
    RATE_UPLOAD:        str = "20/hour"     # file uploads per user

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
