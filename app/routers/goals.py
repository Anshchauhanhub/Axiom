"""
Router — Goals.

Create goals (triggers LLM roadmap generation) and retrieve existing ones.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.goal import Goal
from app.models.user import User
from app.schemas.goal import GoalResponse
from app.services.goal_gen import generate_goal
from app.utils.auth import get_current_user

router = APIRouter()


class GoalCreateRequest(BaseModel):
    title: str
    total_days: int
    syllabus: str


class RoadmapGenerateRequest(BaseModel):
    user_msg: str
    study_schedule: list[str]


@router.post("/", response_model=GoalResponse, status_code=201)
async def create_goal(
    payload: GoalCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new goal — calls the LLM to generate tasks and parts."""
    goal = await generate_goal(
        user=user,
        db=db,
        title=payload.title,
        total_days=payload.total_days,
        syllabus_text=payload.syllabus,
    )
    return goal


@router.post("/generate", response_model=GoalResponse, status_code=201)
async def generate_roadmap_endpoint(
    payload: RoadmapGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Onboarding endpoint: 
    1. Updates user study schedule.
    2. Generates a full roadmap from a natural language prompt.
    """
    # Update user's study schedule
    user.study_schedule = {"times": payload.study_schedule}
    db.add(user)
    await db.flush()

    # Generate goal
    goal = await generate_goal(
        user=user,
        db=db,
        syllabus_text=payload.user_msg,
    )
    return goal


@router.get("/", response_model=list[GoalResponse])
async def get_my_goals(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Fetch all goals for the current user."""
    result = await db.execute(
        select(Goal).where(Goal.user_id == user.id)
    )
    return result.scalars().all()


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Fetch a single goal by ID."""
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found.")
    return goal
