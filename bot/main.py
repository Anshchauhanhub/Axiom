"""
Axiom — Telegram Bot Entry Point.

Starts the aiogram dispatcher in long-polling mode (dev) or webhook mode (prod).
"""

import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from app.config import settings
from app.services.scheduler import start_scheduler, stop_scheduler
from bot.handlers import start, onboarding, daily_task, quiz
from bot.middlewares.auth import AuthMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main() -> None:
    """Bootstrap and run the Telegram bot."""
    bot = Bot(
        token=settings.TELEGRAM_BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    dp = Dispatcher()

    # ── Register middleware ─────────────────────────────
    dp.message.middleware(AuthMiddleware())

    # ── Register handlers ──────────────────────────────
    dp.include_router(start.router)
    dp.include_router(onboarding.router)
    dp.include_router(daily_task.router)
    dp.include_router(quiz.router)

    # ── Start scheduler ─────────────────────────────────
    start_scheduler()

    try:
        logger.info("🤖 Axiom bot is starting (long-polling) …")
        await dp.start_polling(bot)
    finally:
        stop_scheduler()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
