"""Pydantic schemas for User."""

from datetime import datetime
from pydantic import BaseModel, Field
from zoneinfo import ZoneInfo
import uuid


class UserCreate(BaseModel):
    """Create user - supports both Telegram and Web registration."""
    user_id: str = str(uuid.uuid4())
    username: str | None = None
    telegram_id: int | None = None
    email: str | None = None
    password: str | None = None
    timezone: str = "UTC"
    current_goal: str | None = None
    hours_per_day: int = 2
    created_at: datetime = datetime.now(ZoneInfo("Asia/Kolkata"))


class UserUpdate(BaseModel):
    """Update user profile."""
    username: str | None = None
    timezone: str | None = None
    current_goal: str | None = None
    hours_per_day: int | None = None


class UserResponse(BaseModel):
    """User response - excludes sensitive data."""
    id: int
    user_id: str
    telegram_id: int | None = None
    email: str | None = None
    username: str | None = None
    timezone: str
    streak_count: int
    current_goal: str | None = None
    hours_per_day: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    """Web registration request."""
    email: str
    password: str
    username: str | None = None


class LoginRequest(BaseModel):
    """Web login request."""
    email: str
    password: str


class TokenResponse(BaseModel):
    """Login/register response with token."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse