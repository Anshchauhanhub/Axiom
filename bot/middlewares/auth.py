"""
Middleware — Auth.

Auto-registers users in the database on their first message.
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
        telegram_id = event.from_user.id
        username = event.from_user.username

        async with async_session_factory() as session:
            result = await session.execute(
                select(User).where(User.telegram_id == telegram_id)
            )
            user = result.scalar_one_or_none()

            if not user:
                user = User(telegram_id=telegram_id, username=username)
                session.add(user)
                await session.commit()
                await session.refresh(user)

            data["db_user"] = user
            data["db_session"] = session

            return await handler(event, data)
