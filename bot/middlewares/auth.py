"""
Middleware — Auth.

Auto-registers Telegram users or links them to existing web accounts
by matching their Telegram phone contact or chat_id.
Injects the ``User`` object into handler data for convenience.
"""

from typing import Any, Awaitable, Callable, Dict

from aiogram import BaseMiddleware
from aiogram.types import Message
from sqlalchemy import select

from app.db.session import async_session_factory
from app.models import User


class AuthMiddleware(BaseMiddleware):
    """Ensure every incoming message has a registered user."""

    async def __call__(
        self,
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        event: Message,
        data: Dict[str, Any],
    ) -> Any:
        telegram_chat_id = event.from_user.id
        username = event.from_user.username

        async with async_session_factory() as session:
            # 1. Try to find by telegram_chat_id (already linked)
            result = await session.execute(
                select(User).where(User.telegram_chat_id == telegram_chat_id)
            )
            user = result.scalar_one_or_none()

            if not user:
                # 2. Check if contact was shared — try to link by phone
                if event.contact and event.contact.phone_number:
                    phone = event.contact.phone_number
                    # Normalize: add + if missing
                    if not phone.startswith("+"):
                        phone = "+" + phone
                    
                    phone_result = await session.execute(
                        select(User).where(User.phone_number == phone)
                    )
                    user = phone_result.scalar_one_or_none()
                    
                    if user:
                        # Link this Telegram account to the web account!
                        user.telegram_chat_id = telegram_chat_id
                        if not user.username and username:
                            user.username = username
                        await session.commit()
                        await session.refresh(user)

            if not user:
                # 3. No match — create a minimal Telegram-only user
                user = User(
                    telegram_chat_id=telegram_chat_id,
                    username=username,
                    email=f"tg_{telegram_chat_id}@axiom.placeholder",
                    password_hash="",
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)

            data["db_user"] = user
            data["db_session"] = session

            return await handler(event, data)
