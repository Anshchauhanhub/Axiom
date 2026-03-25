"""Pydantic schemas for QuizResult."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class QuizResultResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    part_id: uuid.UUID
    score: int
    is_passed: bool
    completed_at: datetime

    model_config = {"from_attributes": True}
