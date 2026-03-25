"""
Router — Tasks.

Manage tasks (major chapters) within a goal.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.task import Task
from app.models.goal import Goal
from app.models.user import User
from app.schemas.task import TaskResponse, TaskUpdate
from app.utils.auth import get_current_user

router = APIRouter()


@router.get("/goal/{goal_id}", response_model=list[TaskResponse])
async def get_tasks_by_goal(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all tasks for a given goal (ordered by order_index)."""
    # Verify the goal belongs to the user
    goal_result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id)
    )
    if not goal_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Goal not found.")

    result = await db.execute(
        select(Task).where(Task.goal_id == goal_id).order_by(Task.order_index)
    )
    return result.scalars().all()


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Fetch a single task by ID."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a task's status."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    await db.flush()
    await db.refresh(task)
    return task
