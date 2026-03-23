"""
Service — Gatekeeper.

Evaluates quiz answers, updates task status and user streak.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, TaskStatus
from app.models.user import User
from app.models.verification import Verification

PASS_THRESHOLD = 0.8  # 80%


async def evaluate_quiz(
    task_id: int,
    user_answers: list[int],
    mcq_json: dict,
    user_id: int,
    db: AsyncSession,
    telegram_id: int | None = None,
) -> Verification:
    """
    Score the user's answers and decide PASS / FAIL.

    Pass (≥80%):  Task → Verified, streak +1.
    Fail (<80%):  Task → Rescheduled, streak unchanged.
    """
    questions = mcq_json.get("questions", [])
    total = len(questions)
    correct = sum(
        1
        for q, ans in zip(questions, user_answers)
        if q.get("correct") == ans
    )
    score = correct / total if total > 0 else 0.0
    passed = score >= PASS_THRESHOLD

    # ── Persist verification ────────────────────────────
    verification = Verification(
        task_id=task_id,
        mcq_json=mcq_json,
        score=score,
        attempts=1,
        passed=passed,
    )
    db.add(verification)

    # ── Update task status ──────────────────────────────
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one()
    task.status = TaskStatus.VERIFIED if passed else TaskStatus.RESCHEDULED

    # ── Update streak ───────────────────────────────────
    if passed:
        if telegram_id:
            user_result = await db.execute(
                select(User).where(User.telegram_id == telegram_id)
            )
        else:
            user_result = await db.execute(
                select(User).where(User.id == user_id)
            )
        user = user_result.scalar_one()
        user.streak_count += 1

    await db.flush()
    await db.refresh(verification)
    return verification

