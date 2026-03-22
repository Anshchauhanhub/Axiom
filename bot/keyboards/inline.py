"""
Inline Keyboards — MCQ answers and task actions.

These are the "tap-to-answer" buttons displayed inside Telegram.
"""

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


def build_task_keyboard(task_id: int) -> InlineKeyboardMarkup:
    """Build the daily nudge keyboard with a 'Mark as Done' button."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ Mark as Done",
                    callback_data=f"task_done:{task_id}",
                )
            ]
        ]
    )


def build_mcq_keyboard(
    task_id: int,
    question_index: int,
    options: list[str],
) -> InlineKeyboardMarkup:
    """
    Build an inline keyboard for a single MCQ question.

    Each option is a button; tapping calls back with the selected index.
    """
    buttons = [
        [
            InlineKeyboardButton(
                text=f"{chr(65 + i)}. {option}",
                callback_data=f"mcq_answer:{task_id}:{question_index}:{i}",
            )
        ]
        for i, option in enumerate(options)
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)
