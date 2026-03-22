"""Pydantic schemas for Verification."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class VerificationCreate(BaseModel):
    task_id: int
    mcq_json: dict[str, Any]


class VerificationResponse(BaseModel):
    id: int
    task_id: int
    mcq_json: dict[str, Any]
    score: float
    attempts: int
    passed: bool
    created_at: datetime

    model_config = {"from_attributes": True}
