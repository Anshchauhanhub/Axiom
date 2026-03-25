"""
Handler — Quiz (MCQ Gatekeeper via Redis).

Handles inline keyboard callbacks for answering MCQ questions.
Quiz sessions are stored in Redis with a 15-minute TTL.
"""

from aiogram import Router
from aiogram.types import CallbackQuery
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.redis_client import get_quiz_session, update_quiz_session
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
    selected = int(parts[3])

    session = await get_quiz_session(callback.from_user.id)
    if not session:
        await callback.answer("Quiz session expired or not found. Start a new quiz.", show_alert=True)
        return

    questions = session["questions"]
    
    if question_idx != session.get("current_question", 0):
        await callback.answer("You answered this question already.", show_alert=True)
        return

    correct = questions[question_idx].get("correct") == selected
    if correct:
        session["current_score"] = session.get("current_score", 0) + 1

    session["current_question"] = question_idx + 1
    await update_quiz_session(callback.from_user.id, session)

    await callback.answer(f"Answer #{question_idx + 1} recorded ✓")

    if session["current_question"] < len(questions):
        # Next question
        next_idx = session["current_question"]
        q = questions[next_idx]
        await callback.message.edit_text(
            f"<b>Question {next_idx + 1}/{len(questions)}</b>\n\n{q['question']}",
            reply_markup=build_mcq_keyboard(part_id, next_idx, q['options']),
            parse_mode="HTML"
        )
    else:
        # Evaluate quiz
        await callback.message.edit_text("⏳ Evaluating your quiz...", parse_mode="HTML")
        quiz_result = await evaluate_quiz(db_user, callback.from_user.id, db_session)
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
