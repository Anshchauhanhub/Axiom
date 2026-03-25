"""
Inline Keyboards — MCQ answers and task actions.

These are the "tap-to-answer" buttons displayed inside Telegram.
"""

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


def build_task_keyboard(part_id: str) -> InlineKeyboardMarkup:
    """Build the daily nudge keyboard with a 'Start Mastery Quiz' button."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🔒 Start Mastery Quiz",
                    callback_data=f"start_quiz:{part_id}",
                )
            ]
        ]
    )


def build_mcq_keyboard(
    part_id: str,
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
                callback_data=f"mcq_answer:{part_id}:{question_index}:{i}",
            )
        ]
        for i, option in enumerate(options)
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)
