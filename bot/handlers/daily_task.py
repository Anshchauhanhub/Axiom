"""
Handler — Daily Task Nudge.

Handles user interaction with the daily study nudge message (Start Quiz button).
"""

import uuid
from aiogram import Router
from aiogram.types import CallbackQuery
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services.session_manager import create_quiz_session_db
from app.services.mcq_gen import create_quiz_for_task
from app.models.part import Part
from bot.keyboards.inline import build_mcq_keyboard

router = Router()


@router.callback_query(lambda c: c.data and c.data.startswith("start_quiz:"))
async def handle_start_quiz(callback: CallbackQuery, db_session: AsyncSession) -> None:
    """
    User clicked 'Start Quiz' — trigger the MCQ gatekeeper quiz.

    Callback data format: start_quiz:<part_id>
    """
    part_id = callback.data.split(":")[1]

    try:
        pid = uuid.UUID(part_id)
        result = await db_session.execute(select(Part).where(Part.id == pid))
        part = result.scalar_one_or_none()
        
        if not part:
            await callback.answer("Part not found.", show_alert=True)
            return

        await callback.answer("📝 Generating your questions...")
        await callback.message.edit_text(
            f"🔒 <b>Gatekeeper Quiz: {part.title}</b>\n\n"
            "Answer 5 questions to prove mastery.\n"
            "You need ≥80% to pass.\n"
            "⚠️ You have <b>15 minutes</b> — no pausing!\n\n"
            "Generating...",
            parse_mode="HTML"
        )

        # Use pre-generated questions if available
        if part.quiz_data:
            questions = part.quiz_data.get("questions", [])
        else:
            mcq_data = await create_quiz_for_task(part.title, None)
            questions = mcq_data.get("questions", [])
        
        if not questions:
            await callback.message.edit_text("❌ Failed to generate questions.")
            return

        # Store in DB
        await create_quiz_session_db(
            db=db_session,
            session_id=str(callback.from_user.id),
            user_id=part.task.user_id, # Assuming part.task has user_id
            part_id=part.id,
            questions=questions,
        )

        # Send first question
        q = questions[0]
        await callback.message.edit_text(
            f"<b>Question 1/{len(questions)}</b>\n\n{q['question']}",
            reply_markup=build_mcq_keyboard(part_id, 0, q['options']),
            parse_mode="HTML"
        )

    except Exception as e:
        await callback.message.edit_text(f"❌ Failed to start quiz: {str(e)}")
