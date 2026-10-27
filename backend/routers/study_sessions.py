from datetime import datetime, timezone, timedelta
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database import get_db
from models import User, StudySession, Part
from auth import get_current_user

router = APIRouter(prefix="/study", tags=["Study Sessions"])

class StartSessionRequest(BaseModel):
    part_id: str

class EndSessionRequest(BaseModel):
    session_id: str

@router.post("/start")
async def start_session(
    req: StartSessionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    part_result = await db.execute(select(Part).where(Part.id == req.part_id))
    part = part_result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
        
    session = StudySession(
        user_id=user.id,
        part_id=part.id,
        started_at=datetime.now(timezone.utc)
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {"session_id": session.id}

@router.post("/end")
async def end_session(
    req: EndSessionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    session_result = await db.execute(
        select(StudySession).where(StudySession.id == req.session_id, StudySession.user_id == user.id)
    )
    session = session_result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if session.ended_at:
        raise HTTPException(status_code=400, detail="Session already ended")
        
    session.ended_at = datetime.now(timezone.utc)
    
    # calculate duration
    # started_at might be timezone aware
    started_at = session.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
        
    delta = session.ended_at - started_at
    session.duration_seconds = int(delta.total_seconds())
    
    await db.commit()
    await db.refresh(session)
    return session

@router.get("/history")
async def get_history(
    days: int = 7,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(StudySession)
        .where(StudySession.user_id == user.id, StudySession.started_at >= cutoff)
        .order_by(StudySession.started_at.desc())
    )
    sessions = result.scalars().all()
    return sessions
