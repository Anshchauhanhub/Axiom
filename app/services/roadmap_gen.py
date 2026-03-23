"""
Service — Roadmap Generation.

Takes a user's syllabus + goal and calls the LLM to produce a structured
JSON learning plan. Tasks are then persisted in the database.
"""

from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import HTTPException

from app.llm.client import generate_json_roadmap
from app.models.roadmap import Roadmap
from app.models.task import Task
from app.schemas.roadmap import RoadmapCreate


async def generate_roadmap(payload: RoadmapCreate, db: AsyncSession) -> Roadmap:
    """
    End-to-end roadmap creation:
      1. Call LLM with syllabus text.
      2. Parse & validate the JSON plan.
      3. Persist Roadmap + child Tasks.
    """
    # ── 1. LLM call ────────────────────────────────────
    json_plan = await generate_json_roadmap(payload.raw_syllabus)

    # ── 2. Persist Roadmap ─────────────────────────────
    roadmap = Roadmap(
        user_id=payload.user_id,
        raw_syllabus=payload.raw_syllabus,
        json_plan=json_plan,
        start_date=payload.start_date,
    )
    db.add(roadmap)
    await db.flush()

    # ── 3. Create Tasks from plan ──────────────────────
    days = json_plan.get("days", [])
    for i, day_data in enumerate(days):
        task = Task(
            roadmap_id=roadmap.id,
            title=day_data.get("title", f"Day {i + 1}"),
            description=day_data.get("description"),
            due_date=payload.start_date + timedelta(days=i),
            duration_hours=day_data.get("duration_hours", 2),
        )
        db.add(task)

    await db.flush()
    await db.refresh(roadmap)
    return roadmap
