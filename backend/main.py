import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from database import init_db
from routers.users import router as auth_router, profile_router
from routers.goals import router as goals_router
from routers.quiz import router as quiz_router
from routers.telegram import router as telegram_router, set_bot_app
from bot import create_bot_app
from services.scheduler import start_scheduler, set_bot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("axiom")

# Track bot state globally
_bot_started = False
_bot_app_ref = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    global _bot_started, _bot_app_ref
    logger.info("🚀 Axiom AI Backend starting...")

    # Initialize database tables
    await init_db()
    logger.info("✅ Database tables created/verified.")

    # Initialize Telegram bot
    disable_telegram = os.getenv("DISABLE_TELEGRAM", "false").lower() in ("true", "1", "yes", "t")
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    
    if not disable_telegram and bot_token and bot_token != "your-telegram-bot-token-here":
        try:
            bot_app = create_bot_app()
            await bot_app.initialize()
            set_bot_app(bot_app)
            set_bot(bot_app.bot)

            # Start polling with conflict handling
            await bot_app.start()
            try:
                await bot_app.updater.start_polling(drop_pending_updates=True, timeout=10)
            except Exception as polling_err:
                if "Conflict" in str(polling_err):
                    logger.warning("⚠️ Bot conflict detected (possibly old instance still shutting down). Retrying in 2s...")
                    await asyncio.sleep(2)
                    await bot_app.updater.start_polling(drop_pending_updates=True, timeout=10)
                else:
                    raise polling_err
            
            _bot_started = True
            _bot_app_ref = bot_app
            logger.info("✅ Telegram bot started with polling.")
        except Exception as e:
            logger.warning(f"⚠️ Telegram bot failed to start: {e}")
            _bot_started = False
            _bot_app_ref = None
    else:
        if disable_telegram:
            logger.info("⚠️ Telegram bot disabled via DISABLE_TELEGRAM environment variable.")
        else:
            logger.warning("⚠️ TELEGRAM_BOT_TOKEN not set. Bot disabled.")

    # Start nudge scheduler
    start_scheduler()
    logger.info("✅ Nudge scheduler started.")

    yield

    # Shutdown — only stop what was actually started
    if _bot_started and _bot_app_ref:
        try:
            await _bot_app_ref.updater.stop()
            await _bot_app_ref.stop()
            await _bot_app_ref.shutdown()
        except Exception as e:
            logger.warning(f"Bot shutdown warning: {e}")
    logger.info("👋 Axiom AI Backend shut down.")


app = FastAPI(
    title="Axiom AI",
    description="High-Accountability AI Learning Coach Backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(goals_router)
app.include_router(quiz_router)
app.include_router(telegram_router)


@app.get("/")
async def root():
    return {
        "name": "Axiom AI",
        "status": "operational",
        "version": "1.0.0",
        "endpoints": {
            "docs": "/docs",
            "auth": "/auth",
            "goals": "/goals",
            "quiz": "/quiz",
            "telegram": "/telegram/webhook",
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok"}