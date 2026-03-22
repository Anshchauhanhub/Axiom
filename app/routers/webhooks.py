"""
Router — Webhooks.

Receives incoming Telegram updates via webhook.
"""

from fastapi import APIRouter, Request

router = APIRouter()


@router.post("/telegram")
async def telegram_webhook(request: Request):
    """
    Receive Telegram updates forwarded by Telegram's webhook.

    In production, the aiogram dispatcher processes these updates.
    This endpoint acts as a pass-through during webhook mode.
    """
    data = await request.json()
    # TODO: Forward `data` to the aiogram dispatcher for processing.
    return {"ok": True}
