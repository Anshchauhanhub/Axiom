"""Pydantic schemas for Part."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.part import PartStatus


class PartCreate(BaseModel):
    task_id: uuid.UUID
    title: str


class PartUpdate(BaseModel):
    status: PartStatus | None = None


class PartResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    title: str
    status: PartStatus
    created_at: datetime

    model_config = {"from_attributes": True}
