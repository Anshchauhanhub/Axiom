from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from database import get_db
from models import User, Goal, Part, Task, QuizResult
from schemas import StartQuizResponse, SubmitAnswerRequest, QuizResultResponse
from auth import get_current_user, JWT_SECRET, JWT_ALGORITHM
from jose import jwt, JWTError
from services.groq import generate_mcqs

router = APIRouter(prefix="/quiz", tags=["Sudden Death Quiz"])

QUIZ_EXPIRY_MINUTES = 15


def _create_quiz_token(user_id: str, part_id: str, correct_indices: list[int]) -> str:
    """Create a temporary signed token for the quiz session."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=QUIZ_EXPIRY_MINUTES)
    payload = {
        "sub": user_id,
        "part_id": part_id,
        "answers": correct_indices,
        "exp": expire
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _verify_quiz_token(token: str, user_id: str):
    """Verify and decode the quiz session token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("sub") != user_id:
            raise HTTPException(status_code=401, detail="Invalid quiz session")
        return payload
    except JWTError:
        raise HTTPException(status_code=410, detail="Quiz session expired or invalid")


@router.post("/start/{part_id}", response_model=StartQuizResponse)
async def start_quiz(
    part_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stateless quiz: doesn't save to DB, creates a 'Neural Seal' (JWT)."""
    # Get part info and verify it belongs to the current user.
    part_result = await db.execute(
        select(Part)
        .join(Task, Part.task_id == Task.id)
        .join(Goal, Task.goal_id == Goal.id)
        .where(Part.id == part_id, Goal.user_id == user.id)
    )
    part = part_result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    if part.status == "locked":
        raise HTTPException(status_code=403, detail="This part is locked. Complete previous parts first.")

    # Generate random MCQs via Groq
    mcqs = await generate_mcqs(part.title, count=5)

    # Extract correct answers for the secret token
    correct_indices = [q.get("correct_index") for q in mcqs]
    quiz_token = _create_quiz_token(str(user.id), str(part.id), correct_indices)

    # Return safe questions list (without correct answers)
    questions_safe = [
        {"question": q["question"], "options": q["options"]}
        for q in mcqs
    ]
    return StartQuizResponse(
        quiz_token=quiz_token,
        part_title=part.title,
        questions=questions_safe,
    )


@router.post("/submit", response_model=QuizResultResponse)
async def submit_quiz(
    req: SubmitAnswerRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify stateless quiz via token."""
    # Decode and verify the quiz session token
    payload = _verify_quiz_token(req.quiz_token, str(user.id))
    part_id = payload.get("part_id")
    correct_indices = payload.get("answers")

    # Score the quiz
    if len(req.answers) != len(correct_indices):
        raise HTTPException(status_code=400, detail=f"Expected {len(correct_indices)} answers, got {len(req.answers)}")

    correct = sum(
        1 for i, correct_idx in enumerate(correct_indices)
        if req.answers[i] == correct_idx
    )
    score = (correct / len(correct_indices)) * 100
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
        part_id=part_id,
        score_percent=score,
        is_passed=is_passed,
    )
    db.add(quiz_result)

    # If passed: unlock next part, update streak
    if is_passed:
        # Mark part as passed
        part_result = await db.execute(select(Part).where(Part.id == part_id))
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
    """For stateless quizzes, we don't have a DB record to resume."""
    return {"active": False}


@router.post("/complete-direct/{part_id}")
async def complete_direct(
    part_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Directly mark a part as completed (for intros/setups) without a quiz."""
    # Verify part belongs to user
    part_result = await db.execute(
        select(Part)
        .join(Task, Part.task_id == Task.id)
        .join(Goal, Task.goal_id == Goal.id)
        .where(Part.id == part_id, Goal.user_id == user.id)
    )
    part = part_result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    if part.status == "locked":
        raise HTTPException(status_code=403, detail="This part is locked.")

    # Mark as passed
    part.status = "passed"

    # Save a generic result to update streak
    quiz_result = QuizResult(
        user_id=user.id,
        part_id=part.id,
        score_percent=100.0,
        is_passed=True,
    )
    db.add(quiz_result)

    # Unlock next part
    siblings = await db.execute(
        select(Part)
        .where(Part.task_id == part.task_id)
        .order_by(Part.order_index)
    )
    all_parts = siblings.scalars().all()

    found_current = False
    for p in all_parts:
        if found_current and p.status == "locked":
            p.status = "active"
            break
        if p.id == part.id:
            found_current = True

    # Check if task passed
    all_passed = all(p.status == "passed" for p in all_parts)
    if all_passed:
        task_result = await db.execute(select(Task).where(Task.id == part.task_id))
        task = task_result.scalar_one_or_none()
        if task:
            task.status = "passed"
            next_task = await db.execute(
                select(Task)
                .where(Task.goal_id == task.goal_id, Task.order_index == task.order_index + 1)
            )
            nt = next_task.scalar_one_or_none()
            if nt:
                nt.status = "active"
                first_part = await db.execute(
                    select(Part).where(Part.task_id == nt.id).order_by(Part.order_index).limit(1)
                )
                fp = first_part.scalar_one_or_none()
                if fp:
                    fp.status = "active"
            else:
                goal_result = await db.execute(select(Goal).where(Goal.id == task.goal_id))
                goal_obj = goal_result.scalar_one_or_none()
                if goal_obj:
                    goal_obj.status = "completed"

    await db.commit()
    return {"message": "Part marked as completed.", "is_passed": True}
