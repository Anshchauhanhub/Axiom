"""
Reply Keyboards — persistent menu buttons.
"""

from aiogram.types import KeyboardButton, ReplyKeyboardMarkup


def build_main_menu() -> ReplyKeyboardMarkup:
    """Build the persistent bottom menu."""
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📊 My Progress"), KeyboardButton(text="🎯 Today's Task")],
            [KeyboardButton(text="🔄 New Goal"), KeyboardButton(text="❓ Help")],
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
    )
