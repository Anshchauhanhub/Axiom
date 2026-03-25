"""
Handler — Daily Task Nudge.

Handles user interaction with the daily study nudge message (Start Quiz button).
"""

from aiogram import Router
from aiogram.types import CallbackQuery

router = Router()


@router.callback_query(lambda c: c.data and c.data.startswith("start_quiz:"))
async def handle_start_quiz(callback: CallbackQuery) -> None:
    """
    User clicked 'Start Quiz' — trigger the MCQ gatekeeper quiz.

    Callback data format: start_quiz:<part_id>
    """
    part_id = callback.data.split(":")[1]

    await callback.answer("📝 Great! Let's verify your mastery…")
    await callback.message.answer(
        f"🔒 <b>Gatekeeper Quiz</b>\n\n"
        "Answer 5 questions to prove mastery.\n"
        "You need ≥80% to pass.\n"
        "⚠️ You have <b>15 minutes</b> — no pausing!\n\n"
        "Let's go! 🚀"
    )

    # TODO: Generate MCQ quiz via redis_client.create_quiz_session
    # and send inline keyboard questions.
