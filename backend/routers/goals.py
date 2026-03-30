from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db
from models import User, Goal, Task, Part
from schemas import (
    CreateGoalRequest, GoalResponse, RoadmapResponse, TaskResponse, PartResponse,
    OnboardingChatRequest, OnboardingChatResponse, FinalizeGoalRequest
)
from auth import get_current_user
from services.grok import generate_roadmap

router = APIRouter(prefix="/goals", tags=["Goals & Roadmap"])


@router.post("/", response_model=GoalResponse)
async def create_goal(
    req: CreateGoalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = Goal(user_id=user.id, title=req.title)
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


@router.post("/{goal_id}/generate-roadmap", response_model=RoadmapResponse)
async def gen_roadmap(
    goal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    # Generate roadmap via Grok
    roadmap_data = await generate_roadmap(goal.title)

    # Create tasks and parts
    tasks_out = []
    for idx, task_data in enumerate(roadmap_data):
        task = Task(
            goal_id=goal.id,
            title=task_data["title"],
            order_index=idx,
            status="active" if idx == 0 else "locked",
        )
        db.add(task)
        await db.flush()

        parts_out = []
        for pidx, part_title in enumerate(task_data.get("parts", [])):
            part = Part(
                task_id=task.id,
                title=part_title,
                order_index=pidx,
                status="active" if idx == 0 and pidx == 0 else "locked",
            )
            db.add(part)
            await db.flush()
            parts_out.append(PartResponse(id=part.id, title=part.title, status=part.status))

        tasks_out.append(TaskResponse(
            id=task.id,
            title=task.title,
            order_index=task.order_index,
            status=task.status,
            parts=parts_out,
        ))

    await db.commit()

    return RoadmapResponse(
        goal=GoalResponse(id=goal.id, title=goal.title, status=goal.status),
        tasks=tasks_out,
    )


@router.get("/{goal_id}/roadmap", response_model=RoadmapResponse)
async def get_roadmap(
    goal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    tasks_result = await db.execute(
        select(Task)
        .where(Task.goal_id == goal.id)
        .options(selectinload(Task.parts))
        .order_by(Task.order_index)
    )
    tasks = tasks_result.scalars().all()

    # Sort parts for each task by their order_index
    for task in tasks:
        task.parts.sort(key=lambda p: p.order_index)

    tasks_out = []
    for task in tasks:
        parts_out = [PartResponse(id=p.id, title=p.title, status=p.status) for p in task.parts]
        tasks_out.append(TaskResponse(
            id=task.id,
            title=task.title,
            order_index=task.order_index,
            status=task.status,
            parts=parts_out,
        ))

    return RoadmapResponse(
        goal=GoalResponse(id=goal.id, title=goal.title, status=goal.status),
        tasks=tasks_out,
    )


@router.get("/", response_model=list[GoalResponse])
async def list_goals(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Goal).where(Goal.user_id == user.id))
    return result.scalars().all()


@router.post("/chat", response_model=OnboardingChatResponse)
async def onboarding_chat(
    req: OnboardingChatRequest,
    user: User = Depends(get_current_user),
):
    # Map pydantic models to dicts for the LLM service
    messages = [m.model_dump() for m in req.messages]
    from services.grok import generate_onboarding_response
    response = await generate_onboarding_response(messages)
    return response


@router.post("/finalize", response_model=RoadmapResponse)
async def finalize_goal(
    req: FinalizeGoalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Strictly deactivate ALL other active goals for this user
    from sqlalchemy import update
    await db.execute(
        update(Goal)
        .where(Goal.user_id == user.id)
        .values(status="paused")
    )
    # Ensure current goal will be the only active one

    # 2. Create Goal
    goal = Goal(user_id=user.id, title=req.title, status="active")
    db.add(goal)
    await db.flush()

    # 2. Create Tasks & Parts from the approved draft
    tasks_out = []
    for idx, task_data in enumerate(req.roadmap):
        task = Task(
            goal_id=goal.id,
            title=task_data["title"],
            order_index=idx,
            status="active" if idx == 0 else "locked",
        )
        db.add(task)
        await db.flush()

        parts_out = []
        for pidx, part_title in enumerate(task_data.get("parts", [])):
            part = Part(
                task_id=task.id,
                title=part_title,
                order_index=pidx,
                status="active" if idx == 0 and pidx == 0 else "locked",
            )
            db.add(part)
            await db.flush()
            parts_out.append(PartResponse(id=part.id, title=part.title, status=part.status))

        tasks_out.append(TaskResponse(
            id=task.id,
            title=task.title,
            order_index=task.order_index,
            status=task.status,
            parts=parts_out,
        ))

    await db.commit()

    return RoadmapResponse(
        goal=GoalResponse(id=goal.id, title=goal.title, status=goal.status),
        tasks=tasks_out,
    )


@router.post("/{goal_id}/activate", response_model=GoalResponse)
async def activate_goal(
    goal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Strictly deactivate ALL goals first to ensure no duplicates
    from sqlalchemy import update
    await db.execute(
        update(Goal)
        .where(Goal.user_id == user.id)
        .values(status="paused")
    )
    await db.commit() # Preliminary commit to clear existing active states

    # 2. Activate target goal
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    goal.status = "active"
    await db.commit()
    await db.refresh(goal)
    return goal
