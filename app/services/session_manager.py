"""
Session Manager — Database-backed quiz sessions.

Replaces redis_client.py for storing active quizzes.
"""

import uuid
from datetime import datetime, timedelta
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quiz_session import QuizSession

async def create_quiz_session_db(
    db: AsyncSession,
    session_id: str,
    user_id: uuid.UUID,
    part_id: uuid.UUID,
    questions: list[dict],
) -> QuizSession:
    """Create a new quiz session in the database."""
    # Delete any existing session for this session_id/part_id combination
    await delete_quiz_session_db(db, session_id, part_id)
    
    expires_at = datetime.now() + timedelta(minutes=15)
    
    session = QuizSession(
        session_id=session_id,
        user_id=user_id,
        part_id=part_id,
        questions=questions,
        answers={},
        expires_at=expires_at
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session

async def get_quiz_session_db(
    db: AsyncSession,
    session_id: str,
    part_id: uuid.UUID,
) -> QuizSession | None:
    """Retrieve an active quiz session from the database."""
    query = select(QuizSession).where(
        QuizSession.session_id == session_id,
        QuizSession.part_id == part_id,
        QuizSession.expires_at > datetime.now()
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def update_quiz_session_db(
    db: AsyncSession,
    session_id: str,
    part_id: uuid.UUID,
    answers: dict | None = None,
    questions: list[dict] | None = None,
) -> QuizSession | None:
    """Update answers or questions for an active session."""
    session = await get_quiz_session_db(db, session_id, part_id)
    if session:
        if answers is not None:
            # Merge answers
            new_answers = dict(session.answers)
            new_answers.update(answers)
            session.answers = new_answers
        if questions is not None:
            session.questions = questions
        await db.commit()
        await db.refresh(session)
    return session

async def delete_quiz_session_db(
    db: AsyncSession,
    session_id: str,
    part_id: uuid.UUID,
) -> None:
    """Remove a quiz session."""
    query = delete(QuizSession).where(
        QuizSession.session_id == session_id,
        QuizSession.part_id == part_id
    )
    await db.execute(query)
    await db.commit()
