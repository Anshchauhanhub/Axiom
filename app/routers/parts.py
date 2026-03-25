"""
Router — Parts.

Manage parts (daily micro-lessons) within a task.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.part import Part
from app.models.task import Task
from app.schemas.part import PartResponse

router = APIRouter()


@router.get("/task/{task_id}", response_model=list[PartResponse])
async def get_parts_by_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """List all parts for a given task."""
    result = await db.execute(
        select(Part).where(Part.task_id == task_id).order_by(Part.created_at)
    )
    return result.scalars().all()


@router.get("/{part_id}", response_model=PartResponse)
async def get_part(
    part_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Fetch a single part by ID."""
    result = await db.execute(select(Part).where(Part.id == part_id))
    part = result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found.")
    return part
