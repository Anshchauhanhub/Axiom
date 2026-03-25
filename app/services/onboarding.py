"""
Service — Onboarding.

Orchestrates the "Interrogation" state machine:
  1. Collect goal
  2. Collect study hours / total days
  3. Collect syllabus
  4. Collect daily routine → AI extracts study_schedule
  5. Trigger goal generation
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def upsert_user_goal(
    telegram_chat_id: int,
    goal: str,
    db: AsyncSession,
) -> User:
    """Set or update a user's current learning goal title."""
    result = await db.execute(
        select(User).where(User.telegram_chat_id == telegram_chat_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError(f"User with telegram_chat_id={telegram_chat_id} not found.")
    # Goal title is stored temporarily in FSM state, not on user directly
    await db.flush()
    await db.refresh(user)
    return user


async def upsert_user_schedule(
    telegram_chat_id: int,
    study_schedule: list[str],
    db: AsyncSession,
) -> User:
    """Set or update a user's daily study schedule (list of time strings)."""
    result = await db.execute(
        select(User).where(User.telegram_chat_id == telegram_chat_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError(f"User with telegram_chat_id={telegram_chat_id} not found.")
    user.study_schedule = study_schedule
    await db.flush()
    await db.refresh(user)
    return user
