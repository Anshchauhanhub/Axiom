"""Pydantic schemas for User."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: str
    password: str
    username: str | None = None
    phone_number: str | None = None


class UserUpdate(BaseModel):
    username: str | None = None
    timezone: str | None = None
    study_schedule: list[str] | None = None


class UserLinkTelegram(BaseModel):
    telegram_chat_id: int


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    telegram_chat_id: int | None = None
    phone_number: str | None = None
    username: str | None = None
    timezone: str
    study_schedule: Any | None = None
    current_streak_days: int
    created_at: datetime

    model_config = {"from_attributes": True}
