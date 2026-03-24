"""
Router — Users.

CRUD endpoints for managing Axiom user profiles.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter()


@router.post("/telegram", response_model=UserResponse, status_code=201)
async def create_user_telegram(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user via Telegram (called by Telegram bot)."""
    if not payload.telegram_id:
        raise HTTPException(status_code=400, detail="telegram_id required for Telegram registration.")
    
    existing = await db.execute(
        select(User).where(User.telegram_id == payload.telegram_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User already registered.")

    user = User(**payload.model_dump(exclude_unset=True))
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/web", response_model=UserResponse, status_code=201)
async def create_user_web(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user via web (email + password handled by auth router)."""
    if not payload.email:
        raise HTTPException(status_code=400, detail="email required for web registration.")
    
    existing = await db.execute(
        select(User).where(User.email == payload.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User already registered.")

    user = User(**payload.model_dump(exclude_unset=True))
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.get("/by-telegram/{telegram_id}", response_model=UserResponse)
async def get_user_by_telegram(telegram_id: int, db: AsyncSession = Depends(get_db)):
    """Fetch a user by their Telegram ID."""
    result = await db.execute(
        select(User).where(User.telegram_id == telegram_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


@router.get("/by-email/{email}", response_model=UserResponse)
async def get_user_by_email(email: str, db: AsyncSession = Depends(get_db)):
    """Fetch a user by their email."""
    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


@router.patch("/by-telegram/{telegram_id}", response_model=UserResponse)
async def update_user_by_telegram(
    telegram_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Partially update a user's profile by Telegram ID."""
    result = await db.execute(
        select(User).where(User.telegram_id == telegram_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)
    return user
