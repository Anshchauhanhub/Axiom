"""Pydantic schemas for Task."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.task import TaskStatus


class TaskCreate(BaseModel):
    goal_id: uuid.UUID
    title: str
    order_index: int


class TaskUpdate(BaseModel):
    status: TaskStatus | None = None


class TaskResponse(BaseModel):
    id: uuid.UUID
    goal_id: uuid.UUID
    title: str
    order_index: int
    status: TaskStatus
    created_at: datetime

    model_config = {"from_attributes": True}
