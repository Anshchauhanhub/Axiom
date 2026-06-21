"""
Edxiom Security Middleware
- Security response headers
- Per-IP rate limiting (sliding window)
- Request body size limiting
"""

import time
import logging
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("edxiom.security")


# ─── Security Headers ────────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects security-related HTTP headers into every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; connect-src 'self' https: wss:; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:; frame-src 'self' https://www.youtube.com https://accounts.google.com;"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        return response


# ─── Rate Limiting ────────────────────────────────────────────────────
class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    In-memory sliding-window rate limiter.
    - Auth endpoints: 5 req/min per IP
    - General API:   60 req/min per IP
    """

    AUTH_PATHS = {"/auth/login", "/auth/register"}
    AUTH_LIMIT = 5
    AUTH_WINDOW = 60  # seconds

    GENERAL_LIMIT = 60
    GENERAL_WINDOW = 60  # seconds

    def __init__(self, app):
        super().__init__(app)
        # {ip: [timestamp, ...]}
        self._auth_hits: dict[str, list[float]] = defaultdict(list)
        self._general_hits: dict[str, list[float]] = defaultdict(list)
        self._last_cleanup = time.time()
        self._cleanup_interval = 300  # 5 minutes

    def _cleanup_stale_entries(self):
        """Periodically prune stale IPs from the dictionaries to prevent memory leaks."""
        now = time.time()
        if now - self._last_cleanup > self._cleanup_interval:
            self._last_cleanup = now
            
            # Prune auth hits
            auth_cutoff = now - self.AUTH_WINDOW
            for ip in list(self._auth_hits.keys()):
                hits = self._auth_hits[ip]
                while hits and hits[0] < auth_cutoff:
                    hits.pop(0)
                if not hits:
                    del self._auth_hits[ip]
                    
            # Prune general hits
            general_cutoff = now - self.GENERAL_WINDOW
            for ip in list(self._general_hits.keys()):
                hits = self._general_hits[ip]
                while hits and hits[0] < general_cutoff:
                    hits.pop(0)
                if not hits:
                    del self._general_hits[ip]

    def _is_rate_limited(self, hits: list[float], limit: int, window: int) -> bool:
        now = time.time()
        cutoff = now - window
        # Prune old entries
        while hits and hits[0] < cutoff:
            hits.pop(0)
        if len(hits) >= limit:
            return True
        hits.append(now)
        return False

    async def dispatch(self, request: Request, call_next):
        self._cleanup_stale_entries()
        
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        # Auth-specific rate limit
        if path in self.AUTH_PATHS and request.method == "POST":
            if self._is_rate_limited(self._auth_hits[client_ip], self.AUTH_LIMIT, self.AUTH_WINDOW):
                logger.warning(f"Rate limit exceeded for {client_ip} on {path}")
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again later."},
                    headers={"Retry-After": str(self.AUTH_WINDOW)},
                )

        # General rate limit
        if self._is_rate_limited(self._general_hits[client_ip], self.GENERAL_LIMIT, self.GENERAL_WINDOW):
            logger.warning(f"General rate limit exceeded for {client_ip}")
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={"Retry-After": str(self.GENERAL_WINDOW)},
            )

        return await call_next(request)


# ─── Request Size Limit ──────────────────────────────────────────────
MAX_BODY_SIZE = 1 * 1024 * 1024  # 1 MB


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Rejects request bodies larger than MAX_BODY_SIZE."""

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_SIZE:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request body too large. Maximum size is 1 MB."},
            )
        return await call_next(request)
