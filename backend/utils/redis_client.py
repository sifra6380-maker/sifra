"""
Centralised Redis client.

All key namespaces:
  rate:<route>:<ip>          slowapi rate-limit counters
  otp_used:<email>:<code>    one-time OTP blacklist (TTL = 10 min)
  failed_otp:<email>         failed OTP attempt counter (TTL = 1 h)
  failed_login:<ip>          failed login attempt counter (TTL = 15 min)
  revoked_token:<jti>        revoked JWT IDs (TTL = access-token lifetime)
  reset_used:<email>:<code>  one-time password-reset code blacklist
"""

import redis.asyncio as aioredis
import redis as syncredis
from ..config import settings

# ── Async client (used in route handlers) ─────────────────────────────────────
_async_client: aioredis.Redis | None = None

def get_async_redis() -> aioredis.Redis:
    global _async_client
    if _async_client is None:
        _async_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    return _async_client


# ── Sync client (used by slowapi limiter storage) ──────────────────────────────
_sync_client: syncredis.Redis | None = None

def get_sync_redis() -> syncredis.Redis:
    global _sync_client
    if _sync_client is None:
        _sync_client = syncredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    return _sync_client


# ── Safe helper decorator ─────────────────────────────────────────────────────

def _redis_safe(default=None):
    """Decorator that catches Redis connection errors and returns a default."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except (ConnectionError, OSError, aioredis.ConnectionError,
                    aioredis.TimeoutError, Exception) as e:
                if "connect" in str(e).lower() or "refused" in str(e).lower() or "timeout" in str(e).lower():
                    return default
                raise
        wrapper.__name__ = func.__name__
        wrapper.__doc__ = func.__doc__
        return wrapper
    return decorator


# ── OTP / reset blacklist helpers ─────────────────────────────────────────────

@_redis_safe(default=None)
async def mark_otp_used(email: str, code: str, ttl_seconds: int = 600) -> None:
    """Prevent OTP replay. Stores key for 10 minutes."""
    r = get_async_redis()
    key = f"otp_used:{email.lower()}:{code}"
    await r.setex(key, ttl_seconds, "1")


@_redis_safe(default=False)
async def is_otp_used(email: str, code: str) -> bool:
    r = get_async_redis()
    key = f"otp_used:{email.lower()}:{code}"
    return await r.exists(key) == 1


@_redis_safe(default=None)
async def mark_reset_code_used(email: str, code: str, ttl_seconds: int = 900) -> None:
    """Prevent password-reset code replay."""
    r = get_async_redis()
    key = f"reset_used:{email.lower()}:{code}"
    await r.setex(key, ttl_seconds, "1")


@_redis_safe(default=False)
async def is_reset_code_used(email: str, code: str) -> bool:
    r = get_async_redis()
    key = f"reset_used:{email.lower()}:{code}"
    return await r.exists(key) == 1


# ── Failed attempt tracking ────────────────────────────────────────────────────

OTP_MAX_ATTEMPTS   = 5
LOGIN_MAX_ATTEMPTS = 10

@_redis_safe(default=0)
async def increment_failed_otp(email: str) -> int:
    """Returns new count. TTL resets every attempt window (1 hour)."""
    r   = get_async_redis()
    key = f"failed_otp:{email.lower()}"
    count = await r.incr(key)
    if count == 1:
        await r.expire(key, 3600)   # first hit → set 1-hour window
    return count


@_redis_safe(default=0)
async def get_failed_otp_count(email: str) -> int:
    r   = get_async_redis()
    val = await r.get(f"failed_otp:{email.lower()}")
    return int(val) if val else 0


@_redis_safe(default=None)
async def clear_failed_otp(email: str) -> None:
    r = get_async_redis()
    await r.delete(f"failed_otp:{email.lower()}")


@_redis_safe(default=0)
async def increment_failed_login(ip: str) -> int:
    r   = get_async_redis()
    key = f"failed_login:{ip}"
    count = await r.incr(key)
    if count == 1:
        await r.expire(key, 900)    # 15-minute window
    return count


@_redis_safe(default=0)
async def get_failed_login_count(ip: str) -> int:
    r   = get_async_redis()
    val = await r.get(f"failed_login:{ip}")
    return int(val) if val else 0


@_redis_safe(default=None)
async def clear_failed_login(ip: str) -> None:
    r = get_async_redis()
    await r.delete(f"failed_login:{ip}")


# ── Token revocation ───────────────────────────────────────────────────────────

@_redis_safe(default=None)
async def revoke_token(jti: str, ttl_seconds: int) -> None:
    """Add a JWT ID to the revocation list. TTL = remaining token lifetime."""
    r = get_async_redis()
    await r.setex(f"revoked_token:{jti}", ttl_seconds, "1")


@_redis_safe(default=False)
async def is_token_revoked(jti: str) -> bool:
    r = get_async_redis()
    return await r.exists(f"revoked_token:{jti}") == 1


# ── Health-check ───────────────────────────────────────────────────────────────

async def ping_redis() -> bool:
    try:
        r = get_async_redis()
        return await r.ping()
    except Exception:
        return False
