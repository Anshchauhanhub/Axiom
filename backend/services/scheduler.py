import os
import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session
from models import User

logger = logging.getLogger("axiom.scheduler")

scheduler = AsyncIOScheduler()
_bot_instance = None


def set_bot(bot):
    global _bot_instance
    _bot_instance = bot


async def check_and_send_nudges():
    """Check all users' study schedules and send Telegram nudges at the right time."""
    if _bot_instance is None:
        return

    now_utc = datetime.utcnow()

    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.telegram_chat_id.isnot(None))
        )
        users = result.scalars().all()

        for user in users:
            try:
                import pytz
                user_tz = pytz.timezone(user.timezone or "Asia/Kolkata")
                user_now = datetime.now(user_tz)
                current_time_str = user_now.strftime("%H:%M")

                schedule = user.study_schedule or ["12:00", "18:00"]

                if current_time_str in schedule:
                    await _bot_instance.send_message(
                        chat_id=user.telegram_chat_id,
                        text=(
                            f"⚡ *Axiom AI — Precision Nudge*\n\n"
                            f"It's `{current_time_str}` in your timezone.\n"
                            f"Your study session is ready.\n\n"
                            f"Type /quiz to begin.\n\n"
                            f"_Stay on track. Stay accountable._"
                        ),
                        parse_mode="Markdown",
                    )
                    print("Nudge sent to user", user.id, "at", current_time_str)
                    logger.info(f"Nudge sent to user {user.id} at {current_time_str}")
            except Exception as e:
                logger.error(f"Nudge failed for user {user.id}: {e}")


def start_scheduler():
    """Start the APScheduler to check nudges every minute."""
    scheduler.add_job(
        check_and_send_nudges,
        trigger=IntervalTrigger(minutes=1),
        id="nudge_checker",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Nudge scheduler started.")
