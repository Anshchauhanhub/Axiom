"""
Router — Roadmaps.

Create a roadmap (triggers LLM generation) and retrieve existing ones.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.roadmap import Roadmap
from app.schemas.roadmap import RoadmapCreate, RoadmapResponse
from app.services.roadmap_gen import generate_roadmap

router = APIRouter()


@router.post("/", response_model=RoadmapResponse, status_code=201)
async def create_roadmap(payload: RoadmapCreate, db: AsyncSession = Depends(get_db)):
    """Create a new roadmap — calls the LLM to generate a JSON plan."""
    roadmap = await generate_roadmap(payload, db)
    return roadmap


@router.get("/{roadmap_id}", response_model=RoadmapResponse)
async def get_roadmap(roadmap_id: int, db: AsyncSession = Depends(get_db)):
    """Fetch a roadmap by its ID."""
    result = await db.execute(select(Roadmap).where(Roadmap.id == roadmap_id))
    roadmap = result.scalar_one_or_none()
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found.")
    return roadmap


@router.get("/user/{user_id}", response_model=list[RoadmapResponse])
async def get_user_roadmaps(user_id: int, db: AsyncSession = Depends(get_db)):
    """Fetch all roadmaps for a given user."""
    result = await db.execute(select(Roadmap).where(Roadmap.user_id == user_id))
    return result.scalars().all()
