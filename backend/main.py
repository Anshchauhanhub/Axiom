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

from middleware import SecurityHeadersMiddleware, RateLimitMiddleware, RequestSizeLimitMiddleware

from database import init_db
from routers.users import router as auth_router, profile_router
from routers.goals import router as goals_router
from routers.quiz import router as quiz_router
from routers.telegram import router as telegram_router, set_bot_app
# from routers.social import router as social_router
# from routers.social_ws import router as social_ws_router
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

    # Start nudge scheduler
    start_scheduler()
    logger.info("✅ Nudge scheduler started.")

    # Launch Telegram bot in background so it doesn't block port binding
    disable_telegram = os.getenv("DISABLE_TELEGRAM", "false").lower() in ("true", "1", "yes", "t")
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")

    async def _start_bot():
        """Background task to start Telegram bot without blocking the server."""
        global _bot_started, _bot_app_ref
        try:
            # Wait a moment for the server to fully bind its port first
            await asyncio.sleep(3)

            bot_app = create_bot_app()
            await bot_app.initialize()
            await bot_app.start()
            set_bot_app(bot_app)
            set_bot(bot_app.bot)

            # Start polling — drop old updates to avoid conflict
            await bot_app.updater.start_polling(
                drop_pending_updates=True,
                timeout=10,
                allowed_updates=["message", "callback_query"],
            )

            _bot_started = True
            _bot_app_ref = bot_app
            logger.info("✅ Telegram bot started and polling loop active.")
        except Exception as e:
            logger.warning(f"⚠️ Telegram bot failed to start: {e}")
            _bot_started = False
            _bot_app_ref = None

    bot_task = None
    if not disable_telegram and bot_token and bot_token != "your-telegram-bot-token-here":
        bot_task = asyncio.create_task(_start_bot())
        logger.info("🤖 Telegram bot startup scheduled (background).")
    else:
        if disable_telegram:
            logger.info("⚠️ Telegram bot disabled via DISABLE_TELEGRAM environment variable.")
        else:
            logger.warning("⚠️ TELEGRAM_BOT_TOKEN not set. Bot disabled.")

    yield

    # Shutdown — cancel background task if still running
    if bot_task and not bot_task.done():
        bot_task.cancel()

    # Stop what was actually started
    if _bot_started and _bot_app_ref:
        try:
            await _bot_app_ref.updater.stop()
            await _bot_app_ref.stop()
            await _bot_app_ref.shutdown()
        except Exception as e:
            logger.warning(f"Bot shutdown warning: {e}")
    logger.info("👋 Axiom AI Backend shut down.")


# Conditionally disable API docs in production
_is_dev = os.getenv("APP_ENV", "development") == "development"

app = FastAPI(
    title="Axiom AI",
    description="High-Accountability AI Learning Coach Backend",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _is_dev else None,
    redoc_url="/redoc" if _is_dev else None,
    openapi_url="/openapi.json" if _is_dev else None,
)

# ─── Security Middleware (order matters: outermost runs first) ────────
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)

# ─── CORS — locked to explicit origins ────────────────────────────────
_allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Register routers
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(goals_router)
app.include_router(quiz_router)
app.include_router(telegram_router)
# app.include_router(social_router)
# app.include_router(social_ws_router)
 
# Serve Static Files (Frontend Build)
# In production, Vite builds to /frontend/dist. We copy this to /backend/static in Docker.
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "static"))
logger.info(f"📁 Static files directory: {STATIC_DIR}")
if os.path.exists(STATIC_DIR):
    # Mount assets folder for bundled JS/CSS
    ASSETS_DIR = os.path.join(STATIC_DIR, "assets")
    if os.path.exists(ASSETS_DIR):
        app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")
    
    # Catch-all for SPA routing (React Router)
    @app.get("/{full_path:path}", response_class=FileResponse)
    async def serve_spa(request: Request, full_path: str):
        # Exclude common API-like prefixes
        if full_path.startswith(("auth", "goals", "quiz", "telegram", "profile", "users", "api")):
             return {"detail": "API endpoint not found", "path": full_path}
             
        # Check if requested file exists in STATIC_DIR (like logo.png, favicon.ico)
        file_path = os.path.join(STATIC_DIR, full_path)
        
        if full_path and os.path.isfile(file_path):
            # Explicitly handle common image types to avoid MIME guessing issues
            media_type = None
            if full_path.endswith(".png"):
                media_type = "image/png"
            elif full_path.endswith(".svg"):
                media_type = "image/svg+xml"
            elif full_path.endswith(".ico"):
                media_type = "image/x-icon"
                
            logger.info(f"Serving static file: {full_path} from {file_path} (MIME: {media_type})")
            return FileResponse(file_path, media_type=media_type)

        # Fallback to index.html for SPA routing
        index_path = os.path.join(STATIC_DIR, "index.html")
        if not os.path.exists(index_path):
             logger.error(f"❌ index.html NOT FOUND at {index_path}")
        return FileResponse(index_path)


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