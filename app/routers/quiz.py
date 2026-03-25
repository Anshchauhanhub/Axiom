"""
Router — Quiz (Web + Telegram).

Redis-backed quiz flow: generate → answer → evaluate.
Questions only live in Redis for 15 minutes max.
"""

import uuid

from datetime import datetime, timedelta
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
from app.services.session_manager import (
    create_quiz_session_db,
    get_quiz_session_db,
    update_quiz_session_db,
    delete_quiz_session_db,
)
from app.utils.auth import get_current_user

router = APIRouter()


class QuizStartResponse(BaseModel):
    session_id: str
    part_id: uuid.UUID
    part_title: str
    questions: list[dict]
    total_questions: int
    answers: dict = {}
    expires_at: datetime


class AnswerRequest(BaseModel):
    part_id: uuid.UUID
    question_index: int
    selected_option: str


class AnswerResponse(BaseModel):
    session_id: str
    part_id: uuid.UUID
    correct: bool
    current_score: int
    questions_answered: int
    total_questions: int
    answers: dict
    expires_at: datetime


@router.post("/start/{part_id}", response_model=QuizStartResponse)
async def start_quiz(
    part_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate a new quiz for a part. Stores questions in Redis (15-min TTL)."""
    # Use Telegram ID if linked, otherwise fallback to User UUID (as string)
    session_id = user.telegram_chat_id or str(user.id)

    
    result = await db.execute(select(Part).where(Part.id == part_id))
    part = result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found.")

    
    # Use pre-generated questions if available, otherwise fall back to LLM
    if part.quiz_data:
        questions = part.quiz_data.get("questions", [])
    else:
        mcq_data = await create_quiz_for_task(part.title, None)
        questions = mcq_data.get("questions", [])

    # Store in Database with 15-min expiration
    await create_quiz_session_db(
        db=db,
        session_id=session_id,
        user_id=user.id,
        part_id=part.id,
        questions=questions,
    )

    # Calculate expiration (15 mins)
    expires_at = datetime.now() + timedelta(minutes=15)

    return QuizStartResponse(
        session_id=str(session_id),
        part_id=part_id,
        part_title=part.title,
        questions=[
            {"question": q["question"], "options": q["options"]}
            for q in questions
        ],
        total_questions=len(questions),
        answers={},
        expires_at=expires_at
    )


@router.post("/answer", response_model=AnswerResponse)
async def answer_question(
    payload: AnswerRequest,
    db: AsyncSession = Depends(get_db), # Added db dependency
    user: User = Depends(get_current_user),
):
    """Submit an answer for a specific question in the active quiz session."""
    session_id = user.telegram_chat_id or str(user.id)
    # Get session from DB
    session = await get_quiz_session_db(db, session_id, payload.part_id)
    if not session:
        raise HTTPException(status_code=404, detail="Active quiz session not found or expired.")
    
    questions = session.questions
    answers = session.answers # Assuming answers is a list on the session object
    idx = payload.question_index
    if idx < 0 or idx >= len(questions):
        raise HTTPException(status_code=400, detail="Invalid question index.")

    correct = questions[idx].get("correct") == payload.selected_option
    
    # Update answers dict (key is index as string)
    answers[str(idx)] = payload.selected_option

    current_score = sum(
        1 for i, q in enumerate(questions) if str(i) in answers and q.get("correct") == answers[str(i)]
    )
    questions_answered = len(answers)

    # Update session in DB
    await update_quiz_session_db(
        db=db,
        session_id=session_id,
        part_id=payload.part_id,
        answers=answers,
    )

    return AnswerResponse(
        session_id=str(session_id),
        part_id=payload.part_id,
        correct=correct,
        current_score=int((current_score / len(questions)) * 100),
        questions_answered=questions_answered,
        total_questions=len(questions),
        answers=answers,
        expires_at=session.expires_at
    )


@router.post("/finish", response_model=QuizResultResponse)
async def finish_quiz(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Finalize the quiz: evaluate, save result, progress the user, delete from Redis."""
    session_id = user.telegram_chat_id or str(user.id)
    quiz_result = await evaluate_quiz(
        user=user,
        session_id=session_id,
        db=db,
    )

    if not quiz_result:
        raise HTTPException(
            status_code=410,
            detail="Quiz session expired or not found. Start a new quiz.",
        )

    return quiz_result
