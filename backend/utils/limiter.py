"""
Global rate-limiter instance (slowapi) backed by Redis.

Usage in a route:
    from ..utils.limiter import limiter
    from slowapi.util import get_remote_address

    @router.post("/login")
    @limiter.limit("10/minute")
    async def login(request: Request, ...):
        ...

Rate-limit strings follow the `limits` library syntax:
  "5/minute"  "3/hour"  "1/second"  "100 per day"
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from ..config import settings


def _make_limiter() -> Limiter:
    """
    Build the Limiter.  If Redis is unavailable we fall back to in-memory
    storage so the app still starts (useful in tests / local dev without Redis).
    """
    try:
        # Actually test the connection before committing to Redis storage
        import redis as syncredis
        test_client = syncredis.from_url(
            settings.REDIS_URL,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        test_client.ping()
        test_client.close()

        return Limiter(
            key_func=get_remote_address,
            storage_uri=settings.REDIS_URL,
            default_limits=["200/minute"],   # global safety net
        )
    except Exception:
        # Fallback: in-memory (single process only – fine for development)
        print("[WARN] Redis unavailable — rate limiter using in-memory storage")
        return Limiter(
            key_func=get_remote_address,
            default_limits=["200/minute"],
        )


limiter = _make_limiter()
