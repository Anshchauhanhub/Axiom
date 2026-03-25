"""
Router — Quiz (Web + Telegram).

Redis-backed quiz flow: generate → answer → evaluate.
Questions only live in Redis for 15 minutes max.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.part import Part
from app.models.user import User
from app.schemas.quiz_result import QuizResultResponse
from app.services.gatekeeper import evaluate_quiz
from app.services.mcq_gen import create_quiz_for_task
from app.services.redis_client import (
    create_quiz_session,
    get_quiz_session,
    update_quiz_session,
    delete_quiz_session,
)
from app.utils.auth import get_current_user

router = APIRouter()


class QuizStartResponse(BaseModel):
    part_id: uuid.UUID
    part_title: str
    questions: list[dict]
    total_questions: int


class AnswerRequest(BaseModel):
    question_index: int
    selected_option: int


class AnswerResponse(BaseModel):
    correct: bool
    current_score: int
    questions_answered: int
    total_questions: int


@router.post("/start/{part_id}", response_model=QuizStartResponse)
async def start_quiz(
    part_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate a new quiz for a part. Stores questions in Redis (15-min TTL)."""
    if not user.telegram_chat_id:
        raise HTTPException(
            status_code=400,
            detail="Link your Telegram account first to take quizzes.",
        )

    result = await db.execute(select(Part).where(Part.id == part_id))
    part = result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found.")

    # Generate MCQ questions via LLM
    mcq_data = await create_quiz_for_task(part.title, None)
    questions = mcq_data.get("questions", [])

    # Store in Redis with 15-min TTL
    await create_quiz_session(
        telegram_chat_id=user.telegram_chat_id,
        part_id=part.id,
        questions=questions,
    )

    return QuizStartResponse(
        part_id=part.id,
        part_title=part.title,
        questions=[
            {"question": q["question"], "options": q["options"]}
            for q in questions
        ],
        total_questions=len(questions),
    )


@router.post("/answer", response_model=AnswerResponse)
async def answer_question(
    payload: AnswerRequest,
    user: User = Depends(get_current_user),
):
    """Submit an answer for a specific question in the active quiz session."""
    if not user.telegram_chat_id:
        raise HTTPException(status_code=400, detail="No Telegram link found.")

    session = await get_quiz_session(user.telegram_chat_id)
    if not session:
        raise HTTPException(
            status_code=410,
            detail="Quiz session expired or not found. Start a new quiz.",
        )

    questions = session["questions"]
    idx = payload.question_index
    if idx < 0 or idx >= len(questions):
        raise HTTPException(status_code=400, detail="Invalid question index.")

    correct = questions[idx].get("correct") == payload.selected_option
    if correct:
        session["current_score"] = session.get("current_score", 0) + 1

    session["current_question"] = idx + 1
    await update_quiz_session(user.telegram_chat_id, session)

    return AnswerResponse(
        correct=correct,
        current_score=session["current_score"],
        questions_answered=session["current_question"],
        total_questions=len(questions),
    )


@router.post("/finish", response_model=QuizResultResponse)
async def finish_quiz(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Finalize the quiz: evaluate, save result, progress the user, delete from Redis."""
    if not user.telegram_chat_id:
        raise HTTPException(status_code=400, detail="No Telegram link found.")

    quiz_result = await evaluate_quiz(
        user=user,
        telegram_chat_id=user.telegram_chat_id,
        db=db,
    )

    if not quiz_result:
        raise HTTPException(
            status_code=410,
            detail="Quiz session expired or not found. Start a new quiz.",
        )

    return quiz_result
