"""
Handler — Daily Task Nudge.

Handles user interaction with the daily task message (Mark as Done button).
"""

from aiogram import Router
from aiogram.types import CallbackQuery

router = Router()


@router.callback_query(lambda c: c.data and c.data.startswith("task_done:"))
async def handle_task_done(callback: CallbackQuery) -> None:
    """
    User clicked 'Mark as Done' — trigger the MCQ gatekeeper quiz.
    """
    task_id = int(callback.data.split(":")[1])

    await callback.answer("📝 Great! Let's verify your mastery…")
    await callback.message.answer(
        f"🔒 <b>Gatekeeper Quiz for Task #{task_id}</b>\n\n"
        "Answer 5 questions to prove mastery.\n"
        "You need ≥80% to pass. Let's go!"
    )

    # TODO: Generate MCQ quiz and send inline keyboard questions.
