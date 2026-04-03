from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from database import get_db
from models import User, Goal, Part, Task, ActiveQuiz, QuizResult
from schemas import StartQuizResponse, SubmitAnswerRequest, QuizResultResponse
from auth import get_current_user
from services.groq import generate_mcqs

router = APIRouter(prefix="/quiz", tags=["Sudden Death Quiz"])

QUIZ_EXPIRY_MINUTES = 15


async def _cleanup_expired(user_id, db: AsyncSession):
    """Delete all expired active quizzes for a user."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=QUIZ_EXPIRY_MINUTES)
    await db.execute(
        delete(ActiveQuiz).where(
            ActiveQuiz.user_id == user_id,
            ActiveQuiz.created_at < cutoff,
        )
    )
    await db.commit()


@router.post("/start/{part_id}", response_model=StartQuizResponse)
async def start_quiz(
    part_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Clean up any expired quizzes first
    await _cleanup_expired(user.id, db)

    # Check if already has an active quiz for this part
    existing = await db.execute(
        select(ActiveQuiz).where(
            ActiveQuiz.user_id == user.id,
            ActiveQuiz.part_id == part_id,
        )
    )
    active = existing.scalar_one_or_none()

    if active:
        # Check if expired
        elapsed = datetime.now(timezone.utc) - active.created_at.replace(tzinfo=timezone.utc)
        if elapsed > timedelta(minutes=QUIZ_EXPIRY_MINUTES):
            await db.delete(active)
            await db.commit()
            # Fall through to generate new
        else:
            # Return existing quiz (without correct answers)
            questions_safe = [
                {"question": q["question"], "options": q["options"]}
                for q in active.questions_json
            ]
            part_result = await db.execute(select(Part).where(Part.id == part_id))
            part = part_result.scalar_one_or_none()
            return StartQuizResponse(
                quiz_id=active.id,
                part_title=part.title if part else "Unknown",
                questions=questions_safe,
            )

    # Get part info
    part_result = await db.execute(select(Part).where(Part.id == part_id))
    part = part_result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    if part.status == "locked":
        raise HTTPException(status_code=403, detail="This part is locked. Complete previous parts first.")

    # Generate MCQs via Groq
    mcqs = await generate_mcqs(part.title, count=5)

    # Save to active_quizzes
    quiz = ActiveQuiz(
        user_id=user.id,
        part_id=part.id,
        questions_json=mcqs,
    )
    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)

    # Return without correct_index
    questions_safe = [
        {"question": q["question"], "options": q["options"]}
        for q in mcqs
    ]
    return StartQuizResponse(
        quiz_id=quiz.id,
        part_title=part.title,
        questions=questions_safe,
    )


@router.post("/submit", response_model=QuizResultResponse)
async def submit_quiz(
    req: SubmitAnswerRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Find active quiz
    result = await db.execute(
        select(ActiveQuiz).where(
            ActiveQuiz.id == req.quiz_id,
            ActiveQuiz.user_id == user.id,
        )
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="No active quiz found. It may have expired.")

    # Check 15-minute expiry
    elapsed = datetime.now(timezone.utc) - quiz.created_at.replace(tzinfo=timezone.utc)
    if elapsed > timedelta(minutes=QUIZ_EXPIRY_MINUTES):
        await db.delete(quiz)
        await db.commit()
        raise HTTPException(
            status_code=410,
            detail="Session expired. Generating new questions for your restart.",
        )

    # Score the quiz
    questions = quiz.questions_json
    if len(req.answers) != len(questions):
        raise HTTPException(status_code=400, detail=f"Expected {len(questions)} answers, got {len(req.answers)}")

    correct = sum(
        1 for i, q in enumerate(questions)
        if req.answers[i] == q.get("correct_index")
    )
    score = (correct / len(questions)) * 100
    is_passed = score >= 80

    # Check if we should increment streak today (before adding the current result)
    should_increment = False
    if is_passed:
        recent_passed_result = await db.execute(
            select(QuizResult)
            .where(QuizResult.user_id == user.id)
            .where(QuizResult.is_passed == True)
            .order_by(QuizResult.completed_at.desc())
            .limit(1)
        )
        last_passed = recent_passed_result.scalar_one_or_none()
        today = datetime.now(timezone.utc).date()
        
        if not last_passed:
            should_increment = True
        else:
            last_date = (last_passed.completed_at.replace(tzinfo=timezone.utc).date() 
                         if last_passed.completed_at.tzinfo is None 
                         else last_passed.completed_at.astimezone(timezone.utc).date())
            if last_date < today:
                should_increment = True

    # Save result
    quiz_result = QuizResult(
        user_id=user.id,
        part_id=quiz.part_id,
        score_percent=score,
        is_passed=is_passed,
    )
    db.add(quiz_result)

    # If passed: unlock next part, update streak
    if is_passed:
        # Mark part as passed
        part_result = await db.execute(select(Part).where(Part.id == quiz.part_id))
        part = part_result.scalar_one_or_none()
        if part:
            part.status = "passed"

            # Find all parts in the same task
            siblings = await db.execute(
                select(Part)
                .where(Part.task_id == part.task_id)
                .order_by(Part.order_index)
            )
            all_parts = siblings.scalars().all()

            # Unlock next part
            found_current = False
            for p in all_parts:
                if found_current and p.status == "locked":
                    p.status = "active"
                    break
                if p.id == part.id:
                    found_current = True

            # Check if all parts in task are passed
            all_passed = all(p.status == "passed" for p in all_parts)
            if all_passed:
                task_result = await db.execute(select(Task).where(Task.id == part.task_id))
                task = task_result.scalar_one_or_none()
                if task:
                    task.status = "passed"
                    # Unlock next task
                    next_task = await db.execute(
                        select(Task)
                        .where(Task.goal_id == task.goal_id, Task.order_index == task.order_index + 1)
                    )
                    nt = next_task.scalar_one_or_none()
                    if nt:
                        nt.status = "active"
                        # Unlock first part of next task
                        first_part = await db.execute(
                            select(Part).where(Part.task_id == nt.id).order_by(Part.order_index).limit(1)
                        )
                        fp = first_part.scalar_one_or_none()
                        if fp:
                            fp.status = "active"
                    else:
                        # No next task means goal is complete!
                        goal_result = await db.execute(select(Goal).where(Goal.id == task.goal_id))
                        goal_obj = goal_result.scalar_one_or_none()
                        if goal_obj:
                            goal_obj.status = "completed"

        # Increment streak
        if should_increment:
            user.current_streak += 1

    # Always delete active quiz (passed or failed)
    await db.delete(quiz)
    await db.commit()

    message = (
        f"🏆 Mastery verified! Score: {score:.0f}%. Part unlocked."
        if is_passed
        else f"Score: {score:.0f}%. You need ≥80% to pass. Try again."
    )

    return QuizResultResponse(score_percent=score, is_passed=is_passed, message=message)


@router.get("/active")
async def get_active_quiz(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if user has any active quiz."""
    await _cleanup_expired(user.id, db)

    result = await db.execute(
        select(ActiveQuiz).where(ActiveQuiz.user_id == user.id)
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        return {"active": False}

    questions_safe = [
        {"question": q["question"], "options": q["options"]}
        for q in quiz.questions_json
    ]
    part_result = await db.execute(select(Part).where(Part.id == quiz.part_id))
    part = part_result.scalar_one_or_none()

    elapsed = datetime.now(timezone.utc) - quiz.created_at.replace(tzinfo=timezone.utc)
    remaining = max(0, QUIZ_EXPIRY_MINUTES * 60 - elapsed.total_seconds())

    return {
        "active": True,
        "quiz_id": str(quiz.id),
        "part_title": part.title if part else "Unknown",
        "questions": questions_safe,
        "remaining_seconds": int(remaining),
    }
