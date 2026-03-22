"""
Handler — /start command.

Greets the user and kicks off the onboarding flow.
"""

from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import Message

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message) -> None:
    """Welcome the user to Axiom."""
    await message.answer(
        "🧠 <b>Welcome to Axiom!</b>\n\n"
        "I'm your AI-driven growth partner. I don't just give you a plan — "
        "I <b>enforce</b> it.\n\n"
        "Let's start by understanding your learning goal.\n"
        "Type /onboard to begin the interview. 🚀"
    )
