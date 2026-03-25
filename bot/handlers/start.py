"""
Handler — /start command.

Greets the user. If they registered on the web with a phone number,
prompts them to share their contact to link accounts.
"""

from aiogram import Router, F
from aiogram.filters import CommandStart
from aiogram.types import (
    Message,
    KeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)
from sqlalchemy import select

from app.db.session import async_session_factory
from app.models.user import User
from bot.keyboards.reply import build_main_menu

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message, db_user: User = None, **kwargs) -> None:
    """Welcome the user to Axiom and prompt phone link if needed."""

    if db_user and db_user.phone_number and db_user.telegram_chat_id:
        # Already linked — personalized welcome
        name = db_user.username or "there"
        await message.answer(
            f"👋 <b>Hey {name}!</b>\n\n"
            f"Welcome back to <b>Axiom AI</b> — your AI-driven growth partner.\n\n"
            f"🧠 I'm here to help you master any skill through precision "
            f"nudges and mastery quizzes.\n\n"
            f"Type /onboard to begin your learning journey! 🚀",
            reply_markup=build_main_menu(),
        )
        return

    # Not linked yet — ask them to share their phone to link
    share_contact_kb = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📱 Share My Number", request_contact=True)],
        ],
        resize_keyboard=True,
        one_time_keyboard=True,
    )

    await message.answer(
        "🧠 <b>Welcome to Axiom!</b>\n\n"
        "I'm your AI-driven growth partner. I don't just give you a plan — "
        "I <b>enforce</b> it.\n\n"
        "📱 <b>To link your website account</b>, please tap the button below "
        "to share your phone number. This lets me connect your Telegram to "
        "your web profile.\n\n"
        "If you haven't registered on the website yet, visit it first!",
        reply_markup=share_contact_kb,
    )


@router.message(F.contact)
async def handle_contact(message: Message, db_user: User = None, **kwargs) -> None:
    """Handle shared contact to link Telegram ↔ Web account."""
    phone = message.contact.phone_number
    if not phone.startswith("+"):
        phone = "+" + phone

    async with async_session_factory() as session:
        # Look for a web user with this phone number
        result = await session.execute(
            select(User).where(User.phone_number == phone)
        )
        web_user = result.scalar_one_or_none()

        if web_user:
            # Link them!
            web_user.telegram_chat_id = message.from_user.id
            if not web_user.username and message.from_user.username:
                web_user.username = message.from_user.username
            await session.commit()

            # Delete the old placeholder user if one was created
            if db_user and db_user.email and db_user.email.endswith("@axiom.placeholder"):
                if db_user.id != web_user.id:
                    await session.delete(db_user)
                    await session.commit()

            name = web_user.username or "there"
            await message.answer(
                f"✅ <b>Account Linked!</b>\n\n"
                f"Hey <b>{name}</b>, your Telegram is now synced with your "
                f"web profile ({web_user.email}).\n\n"
                f"🧠 I'll send you study nudges and quizzes right here.\n\n"
                f"Type /onboard to set up your learning roadmap! 🚀",
                reply_markup=build_main_menu(),
            )
        else:
            await message.answer(
                "❌ <b>No matching account found.</b>\n\n"
                f"I couldn't find a web account registered with <code>{phone}</code>.\n\n"
                "Please register on the website first with this phone number, "
                "then come back and click /start again.",
                reply_markup=ReplyKeyboardRemove(),
            )
