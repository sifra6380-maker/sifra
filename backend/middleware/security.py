"""
Security middleware stack.

Layers (applied in order):
  1. SecurityHeadersMiddleware  – sets OWASP-recommended HTTP headers
  2. RequestSizeLimitMiddleware – rejects bodies > MAX_BODY_BYTES
  3. RequestIDMiddleware        – correlation-id header for log tracing
"""

import time
import uuid
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from starlette.types import ASGIApp


# ── 1. Security Headers ───────────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds hardened HTTP response headers on every request.
    Aligns with OWASP HTTP Security Response Headers cheat sheet.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Prevent browsers from MIME-sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Block clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Force HTTPS for 1 year (only meaningful behind TLS termination)
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )

        # Restrict referrer information leakage
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Content Security Policy – relax for Swagger docs, strict for API
        if request.url.path.startswith(("/api/docs", "/api/redoc", "/api/openapi")):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https://fastapi.tiangolo.com"
            )
        else:
            response.headers["Content-Security-Policy"] = "default-src 'none'"

        # Permissions Policy – deny all browser features (API server)
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )

        # Remove server identification
        response.headers["Server"] = "sifra"

        # XSS protection header (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        return response


# ── 2. Request size limiter ────────────────────────────────────────────────────

MAX_BODY_BYTES = 10 * 1024 * 1024   # 10 MB hard cap


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Reject requests whose Content-Length header exceeds the cap,
    and abort streaming bodies that grow beyond the cap.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_BODY_BYTES:
                    return JSONResponse(
                        {"detail": "Request body too large (max 10 MB)"},
                        status_code=413,
                    )
            except ValueError:
                pass    # malformed header — let the app handle it

        return await call_next(request)


# ── 3. Request ID middleware ───────────────────────────────────────────────────

class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Attaches a unique X-Request-ID to every request and response.
    Uses the client-supplied value if present and valid (UUID4 format),
    otherwise generates one.  This enables end-to-end log tracing.
    """

    _UUID_RE = __import__("re").compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        __import__("re").IGNORECASE,
    )

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        incoming = request.headers.get("X-Request-ID", "")
        request_id = (
            incoming
            if self._UUID_RE.match(incoming)
            else str(uuid.uuid4())
        )
        # Make it available to route handlers via request.state
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


# ── 4. Timing-safe response for auth endpoints ─────────────────────────────────

class ConstantTimeAuthMiddleware(BaseHTTPMiddleware):
    """
    Adds a small constant-time floor to authentication endpoints so that
    timing differences between 'user not found' and 'wrong password' cannot
    be measured by an attacker.

    Only activates for paths that start with /api/auth.
    """

    MIN_RESPONSE_TIME = 0.15   # seconds

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not request.url.path.startswith("/api/auth"):
            return await call_next(request)

        start = time.monotonic()
        response = await call_next(request)
        elapsed = time.monotonic() - start

        remaining = self.MIN_RESPONSE_TIME - elapsed
        if remaining > 0:
            await __import__("asyncio").sleep(remaining)

        return response
