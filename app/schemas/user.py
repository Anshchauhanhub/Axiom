"""Pydantic schemas for User."""

from datetime import datetime
from pydantic import BaseModel


class UserCreate(BaseModel):
    telegram_id: int
    username: str | None = None
    timezone: str = "UTC"
    current_goal: str | None = None
    hours_per_day: int = 2


class UserUpdate(BaseModel):
    timezone: str | None = None
    current_goal: str | None = None
    hours_per_day: int | None = None


class UserResponse(BaseModel):
    id: int
    telegram_id: int
    username: str | None
    timezone: str
    streak_count: int
    current_goal: str | None
    hours_per_day: int
    created_at: datetime

    model_config = {"from_attributes": True}
