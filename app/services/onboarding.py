"""
Service — Onboarding.

Orchestrates the "Interrogation" state machine:
  1. Collect goal
  2. Collect hours per day
  3. Collect syllabus
  4. Trigger roadmap generation
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def upsert_user_goal(
    telegram_id: int,
    goal: str,
    db: AsyncSession,
) -> User:
    """Set or update a user's current learning goal."""
    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError(f"User with telegram_id={telegram_id} not found.")
    user.current_goal = goal
    await db.flush()
    await db.refresh(user)
    return user


async def upsert_user_hours(
    telegram_id: int,
    hours: int,
    db: AsyncSession,
) -> User:
    """Set or update a user's daily study hours."""
    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError(f"User with telegram_id={telegram_id} not found.")
    user.hours_per_day = hours
    await db.flush()
    await db.refresh(user)
    return user
