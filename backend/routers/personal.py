from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import models
import schemas
from database import get_db
from auth import get_current_user

router = APIRouter()

@router.get("/", response_model=list[schemas.PersonalTaskResponse])
async def get_personal_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    result = await db.execute(
        select(models.PersonalTask)
        .where(models.PersonalTask.user_id == current_user.id)
        .order_by(models.PersonalTask.scheduled_at.asc())
    )
    return result.scalars().all()


@router.post("/", response_model=schemas.PersonalTaskResponse)
async def create_personal_task(
    task_in: schemas.PersonalTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    new_task = models.PersonalTask(
        user_id=current_user.id,
        title=task_in.title,
        description=task_in.description,
        scheduled_at=task_in.scheduled_at
    )
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)
    return new_task


@router.put("/{task_id}", response_model=schemas.PersonalTaskResponse)
async def update_personal_task(
    task_id: str,
    status_str: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    result = await db.execute(
        select(models.PersonalTask).where(
            models.PersonalTask.id == task_id,
            models.PersonalTask.user_id == current_user.id
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task.status = status_str
    await db.commit()
    await db.refresh(task)
    return task

@router.delete("/{task_id}")
async def delete_personal_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    result = await db.execute(
        select(models.PersonalTask).where(
            models.PersonalTask.id == task_id,
            models.PersonalTask.user_id == current_user.id
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    await db.delete(task)
    await db.commit()
    return {"message": "Deleted successfully"}
