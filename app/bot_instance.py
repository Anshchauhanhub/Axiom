"""
Bot Instance Provider.

Defines the global Bot and Dispatcher instances for use across FastAPI
and background schedulers.
"""

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from app.config import settings
from bot.middlewares.auth import AuthMiddleware
from bot.handlers import start, onboarding, daily_task, quiz

bot = Bot(
    token=settings.TELEGRAM_BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML),
)

dp = Dispatcher()

# Register middleware
dp.message.middleware(AuthMiddleware())
dp.callback_query.middleware(AuthMiddleware())  # Needed for callbacks too

# Register handlers
dp.include_router(start.router)
dp.include_router(onboarding.router)
dp.include_router(daily_task.router)
dp.include_router(quiz.router)
