"""
Service — Scheduler.

Manages APScheduler jobs for daily nudges based on each user's timezone.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()


async def send_daily_nudge(telegram_id: int) -> None:
    """
    Send the user their daily task via Telegram.

    This function is called by APScheduler at the user's configured time.
    """
    # TODO: Fetch today's pending task for the user.
    # TODO: Send message via aiogram bot instance.
    print(f"📩 Nudge sent to telegram_id={telegram_id}")


def schedule_nudge_for_user(telegram_id: int, timezone: str, hour: int = 8) -> None:
    """
    Register (or update) a daily cron job for a user.

    Defaults to 8:00 AM in the user's timezone.
    """
    job_id = f"nudge_{telegram_id}"

    # Remove existing job if present
    existing = scheduler.get_job(job_id)
    if existing:
        scheduler.remove_job(job_id)

    scheduler.add_job(
        send_daily_nudge,
        trigger=CronTrigger(hour=hour, minute=0, timezone=timezone),
        id=job_id,
        args=[telegram_id],
        replace_existing=True,
    )


def start_scheduler() -> None:
    """Start the APScheduler event loop."""
    if not scheduler.running:
        scheduler.start()


def stop_scheduler() -> None:
    """Gracefully shut down APScheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
