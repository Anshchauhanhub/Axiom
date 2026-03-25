"""
Handler — Quiz (MCQ Gatekeeper via Redis).

Handles inline keyboard callbacks for answering MCQ questions.
Quiz sessions are stored in Redis with a 15-minute TTL.
"""

from aiogram import Router
from aiogram.types import CallbackQuery
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.models.user import User
from app.services.session_manager import (
    get_quiz_session_db,
    update_quiz_session_db,
    delete_quiz_session_db,
)
from app.services.gatekeeper import evaluate_quiz
from bot.keyboards.inline import build_mcq_keyboard

router = Router()


@router.callback_query(lambda c: c.data and c.data.startswith("mcq_answer:"))
async def handle_mcq_answer(
    callback: CallbackQuery, 
    db_session: AsyncSession, 
    db_user: User
) -> None:
    """
    Process a user's MCQ answer.

    Callback data format: mcq_answer:<part_id>:<question_index>:<selected_option>
    """
    parts = callback.data.split(":")
    part_id = parts[1]
    question_idx = int(parts[2])
    selected_idx = int(parts[3])

    # Get session from DB
    session = await get_quiz_session_db(db_session, str(callback.from_user.id), uuid.UUID(part_id))
    if not session:
        await callback.answer("Quiz session expired or not found.", show_alert=True)
        return

    questions = session.questions
    answers = session.answers
    
    if str(question_idx) in answers:
        await callback.answer("You answered this question already.", show_alert=True)
        return

    # Update answers dict
    answers[str(question_idx)] = selected_idx
    await update_quiz_session_db(db_session, str(callback.from_user.id), uuid.UUID(part_id), answers=answers)

    await callback.answer(f"Answer #{question_idx + 1} recorded ✓")

    if len(answers) < len(questions):
        # Next question
        next_idx = len(answers)
        q = questions[next_idx]
        await callback.message.edit_text(
            f"<b>Question {next_idx + 1}/{len(questions)}</b>\n\n{q['question']}",
            reply_markup=build_mcq_keyboard(part_id, next_idx, q['options']),
            parse_mode="HTML"
        )
    else:
        # Evaluate quiz
        await callback.message.edit_text("⏳ Evaluating your quiz...", parse_mode="HTML")
        quiz_result = await evaluate_quiz(db=db_session, session_id=callback.from_user.id, part_id=uuid.UUID(part_id))
        await db_session.commit()

        if not quiz_result:
            await callback.message.edit_text("❌ Failed to evaluate quiz: Session expired.")
            return

        passed = quiz_result.is_passed
        score = quiz_result.score

        if passed:
            await callback.message.edit_text(
                f"🎉 <b>You Passed!</b>\n\n"
                f"Score: {score}%\n"
                f"Outstanding! You've verified mastery of this topic. Your streak has increased!\n\n"
                f"I'll see you at your next scheduled time for the next part.",
                parse_mode="HTML"
            )
        else:
            await callback.message.edit_text(
                f"😤 <b>Not Quite...</b>\n\n"
                f"Score: {score}%\n"
                f"You need ≥80% to pass. Review the material and try again.",
                parse_mode="HTML",
                reply_markup=None
            )
