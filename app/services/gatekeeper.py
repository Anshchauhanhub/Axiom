"""
Service — Gatekeeper.

Evaluates quiz answers from Redis session, saves results to PostgreSQL,
and handles part/task/streak progression.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.part import Part, PartStatus
from app.models.quiz_result import QuizResult
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.services.session_manager import get_quiz_session_db, delete_quiz_session_db


PASS_THRESHOLD = 80  # 80% score required to pass


async def evaluate_quiz(
    db: AsyncSession,
    session_id: str | int,
    part_id: uuid.UUID,
) -> QuizResult | None:
    """
    Evaluate the completed quiz from the Redis session.

    1. Read session from DB.
    2. Calculate score percentage.
    3. If passed (≥80%): save QuizResult, mark Part as Passed,
       advance to next part/task, increment streak.
    4. If failed: save QuizResult only, user must retry.
    5. Delete session from DB.
    """
    # ── 1. Fetch from DB ───────────────────────────
    session = await get_quiz_session_db(db, str(session_id), part_id)
    if not session:
        return None

    questions = session.questions
    answers = session.answers
    user_id = session.user_id

    # Calculate score from answers dict
    correct = 0
    for i, q in enumerate(questions):
        idx_str = str(i)
        if idx_str in answers and q.get("correct") == answers[idx_str]:
            correct += 1

    total = len(questions)
    score = int((correct / total) * 100) if total > 0 else 0
    passed = score >= PASS_THRESHOLD

    # We need the User object for streak increment later
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one()

    # ── Persist QuizResult ─────────────────────────────
    quiz_result = QuizResult(
        user_id=user_id,
        part_id=part_id,
        score=score,
        is_passed=passed,
    )
    db.add(quiz_result)

    if passed:
        # ── Mark Part as Passed ────────────────────────
        part_result = await db.execute(select(Part).where(Part.id == part_id))
        part = part_result.scalar_one()
        part.status = PartStatus.PASSED

        # ── Advance to next part in same task ──────────
        task_result = await db.execute(select(Task).where(Task.id == part.task_id))
        task = task_result.scalar_one()

        next_part_result = await db.execute(
            select(Part)
            .where(Part.task_id == task.id, Part.status == PartStatus.LOCKED)
            .order_by(Part.created_at)
            .limit(1)
        )
        next_part = next_part_result.scalar_one_or_none()

        if next_part:
            next_part.status = PartStatus.ACTIVE
            # ── Pre-generate quiz for next part ───────────────
            from app.services.mcq_gen import create_quiz_for_task
            try:
                next_part.quiz_data = await create_quiz_for_task(next_part.title, None)
            except Exception as e:
                print(f"⚠️ Pre-generation failed for next part: {e}")
        else:
            # All parts in this task are passed — mark task as Passed
            task.status = TaskStatus.PASSED

            # Unlock next task in the goal
            from app.models.goal import Goal, GoalStatus
            next_task_result = await db.execute(
                select(Task)
                .where(Task.goal_id == task.goal_id, Task.status == TaskStatus.LOCKED)
                .order_by(Task.order_index)
                .limit(1)
            )
            next_task = next_task_result.scalar_one_or_none()

            if next_task:
                next_task.status = TaskStatus.ACTIVE
                # Unlock first part of next task
                first_part_result = await db.execute(
                    select(Part)
                    .where(Part.task_id == next_task.id)
                    .order_by(Part.created_at)
                    .limit(1)
                )
                first_part = first_part_result.scalar_one_or_none()
                if first_part:
                    first_part.status = PartStatus.ACTIVE
                    # ── Pre-generate quiz for next task's first part ──
                    from app.services.mcq_gen import create_quiz_for_task
                    try:
                        first_part.quiz_data = await create_quiz_for_task(first_part.title, None)
                    except Exception as e:
                        print(f"⚠️ Pre-generation failed for next task part: {e}")
            else:
                # All tasks passed — mark goal as Completed
                goal_result = await db.execute(
                    select(Goal).where(Goal.id == task.goal_id)
                )
                goal = goal_result.scalar_one()
                goal.status = GoalStatus.COMPLETED

        # ── Increment streak ───────────────────────────
        user.current_streak_days += 1

    # ── 4. Cleanup session ──────────────────────────
    await delete_quiz_session_db(db, str(session_id), part_id)

    await db.flush()
    await db.refresh(quiz_result)
    return quiz_result
