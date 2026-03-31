import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
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
 
# Serve Static Files (Frontend Build)
# In production, Vite builds to /frontend/dist. We copy this to /backend/static in Docker.
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(STATIC_DIR):
    # Mount assets folder for bundled JS/CSS
    ASSETS_DIR = os.path.join(STATIC_DIR, "assets")
    if os.path.exists(ASSETS_DIR):
        app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")
    
    # Catch-all for SPA routing (React Router)
    @app.get("/{full_path:path}", response_class=FileResponse)
    async def serve_spa(request: Request, full_path: str):
        # Exclude common API-like prefixes
        if full_path.startswith(("auth", "goals", "quiz", "telegram", "profile", "users")):
             return {"detail": "API endpoint not found", "path": full_path}
             
        index_path = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html")) # Fallback
else:
    logger.warning(f"⚠️ Static directory NOT found at {STATIC_DIR}. Frontend will not be served.")


@app.get("/")
async def root():
    # If static index.html exists, serve it, otherwise return API info
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "name": "Axiom AI API",
        "status": "operational",
        "version": "1.0.0",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    # Render provides PORT environment variable
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)