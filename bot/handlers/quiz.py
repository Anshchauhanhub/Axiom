"""
Handler — Quiz (MCQ Gatekeeper via Redis).

Handles inline keyboard callbacks for answering MCQ questions.
Quiz sessions are stored in Redis with a 15-minute TTL.
"""

from aiogram import Router
from aiogram.types import CallbackQuery

router = Router()


@router.callback_query(lambda c: c.data and c.data.startswith("mcq_answer:"))
async def handle_mcq_answer(callback: CallbackQuery) -> None:
    """
    Process a user's MCQ answer.

    Callback data format: mcq_answer:<part_id>:<question_index>:<selected_option>
    """
    parts = callback.data.split(":")
    part_id = parts[1]
    question_idx = int(parts[2])
    selected = int(parts[3])

    await callback.answer(f"Answer #{question_idx + 1} recorded ✓")

    # TODO:
    # 1. Update Redis session via redis_client.update_quiz_session().
    # 2. If all 5 answered, call gatekeeper.evaluate_quiz().
    # 3. Send pass/fail result + streak update to user.
    # 4. If passed, send: "I'll see you at <next_time_slot> for the next part."
