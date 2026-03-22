"""
Axiom — FastAPI Application Entry Point.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.routers import users, roadmaps, tasks, webhooks


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hook."""
    # ── Startup ─────────────────────────────────────────
    print("🧠 Axiom is starting up …")
    yield
    # ── Shutdown ────────────────────────────────────────
    print("🧠 Axiom is shutting down …")


app = FastAPI(
    title="Axiom",
    description="AI-Driven Growth Partner — proof-of-learning engine.",
    version="0.1.0",
    lifespan=lifespan,
    debug=settings.DEBUG,
)

# ── Register Routers ────────────────────────────────────
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(roadmaps.router, prefix="/api/roadmaps", tags=["Roadmaps"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(webhooks.router, prefix="/webhook", tags=["Webhooks"])


@app.get("/", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "axiom"}
