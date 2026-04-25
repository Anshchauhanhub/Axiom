import os
import logging
from fastapi import APIRouter, Request, HTTPException
from telegram import Update

router = APIRouter(prefix="/telegram", tags=["Telegram Webhook"])
logger = logging.getLogger("axiom.telegram")

_bot_app = None
WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")


def set_bot_app(app):
    global _bot_app
    _bot_app = app


@router.post("/webhook")
async def telegram_webhook(request: Request):
    """Handle incoming Telegram updates via webhook with secret verification."""
    if _bot_app is None:
        raise HTTPException(status_code=503, detail="Bot not initialized")

    # Verify webhook secret to prevent unauthorized fake updates
    if WEBHOOK_SECRET:
        incoming_secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if incoming_secret != WEBHOOK_SECRET:
            logger.warning(f"Webhook request with invalid secret from {request.client.host}")
            raise HTTPException(status_code=403, detail="Forbidden")

    data = await request.json()
    update = Update.de_json(data, _bot_app.bot)
    await _bot_app.process_update(update)
    return {"ok": True}
