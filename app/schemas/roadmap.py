"""Pydantic schemas for Roadmap."""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class RoadmapCreate(BaseModel):
    user_id: int
    raw_syllabus: str
    start_date: date


class RoadmapResponse(BaseModel):
    id: int
    user_id: int
    raw_syllabus: str
    json_plan: dict[str, Any]
    start_date: date
    created_at: datetime

    model_config = {"from_attributes": True}
