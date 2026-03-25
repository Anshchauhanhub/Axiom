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
    from aiogram.types import Update
    from app.bot_instance import dp, bot

    data = await request.json()
    update = Update(**data)
    await dp.feed_update(bot=bot, update=update)
    return {"ok": True}
