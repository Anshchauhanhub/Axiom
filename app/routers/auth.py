"""
Router — Authentication.

Email + password registration and login for the web interface.
"""

import asyncio
import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserResponse
from app.utils.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter()
log = logging.getLogger(__name__)

from fastapi.security import OAuth2PasswordRequestForm

class RegisterRequest(BaseModel):
    email: str
    password: str
    username: str | None = None
    phone_number: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


async def send_telegram_welcome(chat_id: int, username: str | None):
    """Send a welcome message via Telegram bot (runs in background)."""
    try:
        from app.bot_instance import bot
        name = username or "User"
        await bot.send_message(
            chat_id=chat_id,
            text=(
                f"👋 <b>Hey {name}!</b>\n\n"
                f"Welcome to <b>Axiom AI</b> — your AI-driven growth partner.\n\n"
                f"🧠 I'm here to help you master any skill through precision "
                f"nudges and mastery quizzes.\n\n"
                f"Type /start to begin your journey!"
            ),
        )
        log.info(f"Telegram welcome sent to chat_id={chat_id}")
    except Exception as e:
        log.warning(f"Failed to send Telegram welcome: {e}")


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new web user with email + password."""
    payload.email = payload.email.strip().lower()
    if payload.username:
        payload.username = payload.username.strip()
    if payload.phone_number:
        payload.phone_number = payload.phone_number.strip()

    existing = await db.execute(
        select(User).where(User.email == payload.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered.")

    if payload.phone_number:
        existing_phone = await db.execute(
            select(User).where(User.phone_number == payload.phone_number)
        )
        if existing_phone.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Mobile number already registered.")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        username=payload.username,
        phone_number=payload.phone_number,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/token", response_model=TokenResponse)
async def login_oauth(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """Log in using OAuth2 Form Data."""
    username = form_data.username.strip().lower()
    result = await db.execute(
        select(User).where(User.email == username)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    if not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    token = create_access_token(user.id)

    # Send Telegram welcome if linked
    if user.telegram_chat_id:
        asyncio.create_task(send_telegram_welcome(user.telegram_chat_id, user.username))

    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Log in with email + password JSON, returns a JWT."""
    email = payload.email.strip().lower()
    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    token = create_access_token(user.id)

    # Send Telegram welcome if linked
    if user.telegram_chat_id:
        asyncio.create_task(send_telegram_welcome(user.telegram_chat_id, user.username))

    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return user
