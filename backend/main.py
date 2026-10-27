import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, APIRouter
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
from routers.personal import router as personal_router
from routers.study_sessions import router as study_sessions_router
from routers.analytics import router as analytics_router
from routers.goal_stream import router as goal_stream_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("edxiom")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("🚀 Edxiom AI Backend starting...")

    # Initialize database tables
    await init_db()
    logger.info("✅ Database tables verified.")

    yield

    logger.info("👋 Edxiom AI Backend shut down.")


# Conditionally disable API docs in production
_is_dev = os.getenv("APP_ENV", "development") == "development"

app = FastAPI(
    title="Edxiom AI",
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
_allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if _allowed_origins_env:
    _allowed_origins = [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]
else:
    _allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://axiom-t3z9.onrender.com",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "*"],
)

# Register routers with API versioning
api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(profile_router)
api_router.include_router(goals_router)
api_router.include_router(goal_stream_router)
api_router.include_router(quiz_router)
api_router.include_router(study_sessions_router)
api_router.include_router(analytics_router)
api_router.include_router(personal_router, prefix="/personal", tags=["Personal Tasks"])

app.include_router(api_router)

# Specific endpoints must be defined BEFORE the catch-all wildcard
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def root():
    # If static index.html exists, serve it, otherwise return API info
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "name": "Edxiom AI API",
        "status": "operational",
        "version": "1.0.0",
    }


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
        if full_path.startswith("api/"):
             from fastapi.responses import JSONResponse
             return JSONResponse(status_code=404, content={"detail": "API endpoint not found", "path": full_path})
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


if __name__ == "__main__":
    import uvicorn
    # Render provides PORT environment variable
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
