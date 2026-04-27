from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .database import SessionLocal, engine, Base
from . import models
from .utils.auth import hash_password
from .utils.limiter import limiter
from .utils.redis_client import ping_redis
from .config import settings
from .middleware.security import (
    SecurityHeadersMiddleware,
    RequestSizeLimitMiddleware,
    RequestIDMiddleware,
    ConstantTimeAuthMiddleware,
)
from .routes import auth, tasks, store, admin, users, notifications, websocket, payments, chat, freelancers, reviews, favorites, tickets, feedback


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ✅ Create tables
    Base.metadata.create_all(bind=engine)

    # ✅ Seed admin
    db = SessionLocal()
    try:
        existing = db.query(models.Admin).filter(
            models.Admin.email == settings.ADMIN_EMAIL
        ).first()

        if not existing:
            db.add(
                models.Admin(
                    email=settings.ADMIN_EMAIL,
                    hashed_password=hash_password(settings.ADMIN_PASSWORD),
                    full_name="Super Admin",
                    is_super_admin=True,
                )
            )
            db.commit()
            print(f"[OK] Admin seeded: {settings.ADMIN_EMAIL}")
    finally:
        db.close()

    # Redis health
    redis_ok = await ping_redis()
    if redis_ok:
        print("[OK] Redis connected")
    else:
        print("[WARN] Redis unavailable - rate limiting disabled")

    yield


docs_url = "/api/docs" if settings.ENVIRONMENT != "production" else None
redoc_url = "/api/redoc" if settings.ENVIRONMENT != "production" else None

app = FastAPI(
    title="Sifra API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=docs_url,
    redoc_url=redoc_url,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middleware
app.add_middleware(RequestIDMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(ConstantTimeAuthMiddleware)

# Trusted hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"],   # tighten later in production
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(tasks.router)
app.include_router(store.router)
app.include_router(admin.router)
app.include_router(notifications.router)
app.include_router(websocket.router)
app.include_router(payments.router)
app.include_router(chat.router)
app.include_router(freelancers.router)
app.include_router(reviews.router)
app.include_router(favorites.router)
app.include_router(tickets.router)
app.include_router(feedback.router)


@app.get("/")
async def root():
    return {"name": "Sifra API", "status": "running"}


@app.get("/health")
async def health(request: Request):
    redis_ok = await ping_redis()
    return {
        "status": "ok",
        "redis": redis_ok,
        "request_id": getattr(request.state, "request_id", None),
    }