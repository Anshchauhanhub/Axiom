"""
Router — Quiz (Web).

Generates MCQ quizzes and evaluates answers for the web interface.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.task import Task
from app.models.user import User
from app.schemas.verification import VerificationResponse
from app.services.gatekeeper import evaluate_quiz
from app.services.mcq_gen import create_quiz_for_task
from app.utils.auth import get_current_user

router = APIRouter()


class QuizResponse(BaseModel):
    task_id: int
    task_title: str
    questions: list[dict]


class SubmitRequest(BaseModel):
    answers: list[int]
    mcq_json: dict


@router.post("/generate/{task_id}", response_model=QuizResponse)
async def generate_quiz(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate an MCQ quiz for a task."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    mcq_data = await create_quiz_for_task(task.title, task.description)
    return QuizResponse(
        task_id=task.id,
        task_title=task.title,
        questions=mcq_data.get("questions", []),
    )


@router.post("/submit/{task_id}", response_model=VerificationResponse)
async def submit_quiz(
    task_id: int,
    payload: SubmitRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Submit quiz answers for evaluation."""
    verification = await evaluate_quiz(
        task_id=task_id,
        user_answers=payload.answers,
        mcq_json=payload.mcq_json,
        user_id=user.id,
        db=db,
        telegram_id=user.telegram_id,
    )
    return verification
