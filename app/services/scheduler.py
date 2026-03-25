"""
Service — Scheduler.

Manages APScheduler jobs for study nudges based on each user's
study_schedule JSONB (e.g. ["09:00", "20:00"]).
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()


async def send_study_nudge(telegram_chat_id: int, time_slot: str) -> None:
    """
    Send the user their study nudge via Telegram at their scheduled time.

    This function is called by APScheduler at each configured time slot.
    """
    # TODO: Fetch the user's current active part.
    # TODO: Send message via aiogram bot instance.
    print(f"📩 Study nudge sent to chat_id={telegram_chat_id} for time={time_slot}")


def schedule_nudges_for_user(
    telegram_chat_id: int,
    timezone: str,
    study_schedule: list[str],
) -> None:
    """
    Register cron jobs for each time slot in the user's study_schedule.

    study_schedule format: ["09:00", "20:00"]
    """
    # Remove all existing jobs for this user
    for job in scheduler.get_jobs():
        if job.id.startswith(f"nudge_{telegram_chat_id}_"):
            scheduler.remove_job(job.id)

    # Create a job for each study time slot
    for time_slot in study_schedule:
        parts = time_slot.split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0

        job_id = f"nudge_{telegram_chat_id}_{hour:02d}{minute:02d}"
        scheduler.add_job(
            send_study_nudge,
            trigger=CronTrigger(hour=hour, minute=minute, timezone=timezone),
            id=job_id,
            args=[telegram_chat_id, time_slot],
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
