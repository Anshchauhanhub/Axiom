"""Pydantic schemas for Goal."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class GoalCreate(BaseModel):
    title: str
    total_days: int


class GoalResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    total_days: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
