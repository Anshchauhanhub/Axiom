"""
Service — Redis Client.

Manages temporary quiz sessions with a 15-minute TTL.
Questions only live here — never persisted to PostgreSQL.
"""

import json
import uuid

import redis.asyncio as redis

from app.config import settings

QUIZ_TTL_SECONDS = 900  # 15 minutes


async def get_redis() -> redis.Redis:
    """Create and return an async Redis connection."""
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


def _quiz_key(telegram_chat_id: int) -> str:
    """Build the Redis key for a user's active quiz session."""
    return f"quiz_session:{telegram_chat_id}"


async def create_quiz_session(
    telegram_chat_id: int,
    part_id: uuid.UUID,
    questions: list[dict],
) -> None:
    """
    Store a new quiz session in Redis with 15-minute TTL.

    Old session (if any) is overwritten.
    """
    r = await get_redis()
    data = {
        "part_id": str(part_id),
        "current_score": 0,
        "current_question": 0,
        "questions": questions,
    }
    await r.set(
        _quiz_key(telegram_chat_id),
        json.dumps(data),
        ex=QUIZ_TTL_SECONDS,
    )
    await r.aclose()


async def get_quiz_session(telegram_chat_id: int) -> dict | None:
    """Retrieve the active quiz session, or None if expired/missing."""
    r = await get_redis()
    raw = await r.get(_quiz_key(telegram_chat_id))
    await r.aclose()
    if raw is None:
        return None
    return json.loads(raw)


async def update_quiz_session(telegram_chat_id: int, session_data: dict) -> None:
    """Update an existing quiz session (preserves remaining TTL)."""
    r = await get_redis()
    key = _quiz_key(telegram_chat_id)
    ttl = await r.ttl(key)
    if ttl <= 0:
        ttl = QUIZ_TTL_SECONDS
    await r.set(key, json.dumps(session_data), ex=ttl)
    await r.aclose()


async def delete_quiz_session(telegram_chat_id: int) -> None:
    """Immediately delete a quiz session (e.g. after pass/fail)."""
    r = await get_redis()
    await r.delete(_quiz_key(telegram_chat_id))
    await r.aclose()
