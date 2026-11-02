import os
import logging
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session
from models import User, PersonalTask

logger = logging.getLogger("edxiom.scheduler")

scheduler = AsyncIOScheduler()
_bot_instance = None


def set_bot(bot):
    global _bot_instance
    _bot_instance = bot


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)


async def check_and_send_nudges():
    """Check all users' study schedules and send Telegram nudges at the right time."""
    if _bot_instance is None:
        return

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
                            f"⚡ *Exiom AI — Precision Nudge*\n\n"
                            f"It's `{current_time_str}` in your timezone.\n"
                            f"Your study session is ready.\n\n"
                            f"Type /quiz to begin.\n\n"
                            f"_Stay on track. Stay accountable._"
                        ),
                        parse_mode="Markdown",
                    )
                    logger.info(f"Study nudge sent to user {user.id} at {current_time_str}")
            except Exception as e:
                logger.error(f"Study nudge failed for user {user.id}: {e}")


async def check_upcoming_personal_tasks():
    """Remind users about personal tasks due in the next 15 minutes (idempotent)."""
    if _bot_instance is None:
        return

    now_utc = datetime.now(timezone.utc)
    window_end = now_utc + timedelta(minutes=15)

    async with async_session() as db:
        # Fetch tasks due soon that haven't been reminded yet
        result = await db.execute(
            select(PersonalTask, User).join(User, PersonalTask.user_id == User.id).where(
                PersonalTask.scheduled_at >= now_utc,
                PersonalTask.scheduled_at <= window_end,
                PersonalTask.reminded_at.is_(None),
                PersonalTask.status.in_(["active", "pending"]),
                User.telegram_chat_id.isnot(None),
            )
        )
        rows = result.all()

        for task, user in rows:
            try:
                # Atomic idempotency: set reminded_at only if still NULL
                updated_count = await db.execute(
                    sql_update(PersonalTask)
                    .where(
                        PersonalTask.id == task.id,
                        PersonalTask.reminded_at.is_(None),
                    )
                    .values(reminded_at=now_utc)
                )
                await db.commit()

                if updated_count.rowcount == 0:
                    # Another instance already sent this reminder
                    continue

                from zoneinfo import ZoneInfo
                user_tz = ZoneInfo(user.timezone or "Asia/Kolkata")
                task_local = task.scheduled_at.astimezone(user_tz).strftime("%I:%M %p")

                await _bot_instance.send_message(
                    chat_id=user.telegram_chat_id,
                    text=(
                        f"⏰ *Reminder — Upcoming Task*\n\n"
                        f"📌 **{task.title}** is scheduled at `{task_local}` (in ~15 minutes).\n\n"
                        f"_Stay on track!_"
                    ),
                    parse_mode="Markdown",
                )
                logger.info(f"Personal task reminder sent to user {user.id} for task {task.id}")
            except Exception as e:
                logger.error(f"Personal task reminder failed for task {task.id}: {e}")


async def evening_accountability_check():
    """Evening nudge: remind users with pending study tasks."""
    if _bot_instance is None:
        return

    from models import Task, Goal
    now_utc = datetime.now(timezone.utc)

    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.telegram_chat_id.isnot(None))
        )
        users = result.scalars().all()

        for user in users:
            try:
                # Only fire in user's local evening (19:00–21:00)
                from zoneinfo import ZoneInfo
                user_tz = ZoneInfo(user.timezone or "Asia/Kolkata")
                user_now = datetime.now(user_tz)
                if not (19 <= user_now.hour < 21):
                    continue

                # Count pending/active tasks in active goals (Task has no scheduled_at)
                pending_res = await db.execute(
                    select(Task).join(Goal, Task.goal_id == Goal.id).where(
                        Goal.user_id == user.id,
                        Goal.status == "active",
                        Task.status.in_(["locked", "active"]),
                    )
                )
                pending_tasks = pending_res.scalars().all()

                if pending_tasks:
                    count = len(pending_tasks)
                    await _bot_instance.send_message(
                        chat_id=user.telegram_chat_id,
                        text=(
                            f"🌙 *Evening Check-In*\n\n"
                            f"You still have *{count} pending task(s)* on your learning path.\n\n"
                            f"🔥 Current Streak: *{user.current_streak} days*\n\n"
                            f"Don't let your streak slip! Head to the [Study Workbench](https://exiom.live/study) now."
                        ),
                        parse_mode="Markdown",
                    )
                    logger.info(f"Evening accountability nudge sent to user {user.id}")
            except Exception as e:
                logger.error(f"Evening accountability check failed for user {user.id}: {e}")


def start_scheduler():
    """Start the APScheduler with all recurring jobs."""
    # Study-time nudge: check every minute
    scheduler.add_job(
        check_and_send_nudges,
        trigger=IntervalTrigger(minutes=1),
        id="nudge_checker",
        replace_existing=True,
    )
    # Personal task reminder: check every 5 minutes
    scheduler.add_job(
        check_upcoming_personal_tasks,
        trigger=IntervalTrigger(minutes=5),
        id="personal_task_reminder",
        replace_existing=True,
    )
    # Evening accountability check: once every 30 minutes (fires per-user only in 19-21h window)
    scheduler.add_job(
        evening_accountability_check,
        trigger=IntervalTrigger(minutes=30),
        id="evening_accountability",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started: nudge_checker, personal_task_reminder, evening_accountability")
