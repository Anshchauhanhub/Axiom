"""
Router — Users.

CRUD endpoints for managing user profiles + Telegram linking.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserLinkTelegram, UserResponse, UserUpdate
from app.utils.auth import get_current_user

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_user_profile(user: User = Depends(get_current_user)):
    """Fetch the current user's profile."""
    return user


@router.patch("/me", response_model=UserResponse)
async def update_user_profile(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile fields."""
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)
    return user


@router.patch("/link-telegram", response_model=UserResponse)
async def link_telegram(
    payload: UserLinkTelegram,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Link a Telegram chat ID to the authenticated web user."""
    # Check if this telegram_chat_id is already linked to another user
    existing = await db.execute(
        select(User).where(User.telegram_chat_id == payload.telegram_chat_id)
    )
    existing_user = existing.scalar_one_or_none()
    if existing_user and existing_user.id != user.id:
        raise HTTPException(
            status_code=409,
            detail="This Telegram account is already linked to another user.",
        )

    user.telegram_chat_id = payload.telegram_chat_id
    await db.flush()
    await db.refresh(user)
    return user


@router.get("/by-telegram/{telegram_chat_id}", response_model=UserResponse)
async def get_user_by_telegram(
    telegram_chat_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Fetch a user by their Telegram chat ID (used by bot internally)."""
    result = await db.execute(
        select(User).where(User.telegram_chat_id == telegram_chat_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user
