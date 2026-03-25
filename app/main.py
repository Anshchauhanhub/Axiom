"""
Axiom — FastAPI Application Entry Point.
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import users, goals, tasks, parts, webhooks, auth, quiz


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hook."""
    from app.services.scheduler import start_scheduler, stop_scheduler
    from app.bot_instance import bot
    from app.config import settings

    # ── Startup ─────────────────────────────────────────
    print("🧠 Axiom is starting up …")
    start_scheduler()

    if settings.WEBHOOK_BASE_URL:
        webhook_url = f"{settings.WEBHOOK_BASE_URL}/webhook/telegram"
        await bot.set_webhook(url=webhook_url, drop_pending_updates=True)
        print(f"🔗 Bot webhook set to: {webhook_url}")
    else:
        print("⚠️ WEBHOOK_BASE_URL not set. Running bot in long-polling mode requires running bot/main.py separately.")

    yield
    # ── Shutdown ────────────────────────────────────────
    print("🧠 Axiom is shutting down …")
    if settings.WEBHOOK_BASE_URL:
        await bot.delete_webhook(drop_pending_updates=True)
    await bot.session.close()
    stop_scheduler()


app = FastAPI(
    title="Axiom",
    description="AI-Driven Growth Partner — proof-of-learning engine.",
    version="0.2.0",
    lifespan=lifespan,
    debug=settings.DEBUG,
)

# ── CORS ────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routers ────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(goals.router, prefix="/api/goals", tags=["Goals"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(parts.router, prefix="/api/parts", tags=["Parts"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["Quiz"])
app.include_router(webhooks.router, prefix="/webhook", tags=["Webhooks"])


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "axiom"}


# ── Serve Frontend Static Files ─────────────────────────
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
