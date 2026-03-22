"""
Router — Tasks.

Manage individual learning tasks within a roadmap.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.task import Task
from app.schemas.task import TaskResponse, TaskUpdate

router = APIRouter()


@router.get("/roadmap/{roadmap_id}", response_model=list[TaskResponse])
async def get_tasks_by_roadmap(roadmap_id: int, db: AsyncSession = Depends(get_db)):
    """List all tasks for a given roadmap."""
    result = await db.execute(select(Task).where(Task.roadmap_id == roadmap_id))
    return result.scalars().all()


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Fetch a single task by ID."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a task's status or due_date."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    await db.flush()
    await db.refresh(task)
    return task
