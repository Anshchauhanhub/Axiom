"""
Axiom — Application Settings.

All configuration is loaded from environment variables (or a `.env` file)
using pydantic-settings.  Import the singleton ``settings`` wherever needed.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the Axiom platform."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── App ─────────────────────────────────────────────
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "change-me"

    # ── Database ────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+asyncpg://axiom:axiom_secret@localhost:5432/axiom_db"
    )

    # ── Telegram ────────────────────────────────────────
    TELEGRAM_BOT_TOKEN: str = ""
    WEBHOOK_BASE_URL: str = ""

    # ── Gemini (Google AI Studio) ───────────────────────
    GEMINI_API_KEY: str = ""


settings = Settings()
