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
    from app.db.session import async_session_factory
    from sqlalchemy import select
    from app.models.user import User
    from app.models.goal import Goal
    from app.models.task import Task
    from app.models.part import Part
    from app.bot_instance import bot
    from bot.keyboards.inline import build_task_keyboard

    print(f"📩 Triggered study nudge for chat_id={telegram_chat_id} for time={time_slot}")

    async with async_session_factory() as session:
        # Find user
        result = await session.execute(select(User).where(User.telegram_chat_id == telegram_chat_id))
        user = result.scalar_one_or_none()
        if not user:
            return

        # Find latest active goal
        result = await session.execute(
            select(Goal).where(Goal.user_id == user.id, Goal.status == "Active").order_by(Goal.created_at.desc()).limit(1)
        )
        goal = result.scalar_one_or_none()
        if not goal:
            return

        # Find first active task
        result = await session.execute(
            select(Task).where(Task.goal_id == goal.id, Task.status == "Active").order_by(Task.order_index).limit(1)
        )
        task = result.scalar_one_or_none()
        if not task:
            return

        # Find first active part
        result = await session.execute(
            select(Part).where(Part.task_id == task.id, Part.status == "Active").order_by(Part.order_index).limit(1)
        )
        part = result.scalar_one_or_none()
        if not part:
            return

        # Send nudge
        try:
            await bot.send_message(
                chat_id=telegram_chat_id,
                text=f"⏰ <b>Time to study!</b>\n\nYour next topic is: <i>{part.title}</i>\nAre you ready to prove mastery?",
                reply_markup=build_task_keyboard(str(part.id))
            )
            print(f"✅ Nudge sent to {telegram_chat_id}")
        except Exception as e:
            print(f"❌ Failed to send nudge to {telegram_chat_id}: {str(e)}")


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
