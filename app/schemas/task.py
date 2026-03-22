"""Pydantic schemas for Task."""

from datetime import date, datetime

from pydantic import BaseModel

from app.models.task import TaskStatus


class TaskCreate(BaseModel):
    roadmap_id: int
    title: str
    description: str | None = None
    due_date: date
    duration_hours: int = 2


class TaskUpdate(BaseModel):
    status: TaskStatus | None = None
    due_date: date | None = None


class TaskResponse(BaseModel):
    id: int
    roadmap_id: int
    title: str
    description: str | None
    status: TaskStatus
    due_date: date
    duration_hours: int
    created_at: datetime

    model_config = {"from_attributes": True}
