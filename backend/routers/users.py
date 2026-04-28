from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User
from schemas import (
    RegisterRequest, LoginRequest, TokenResponse,
    LinkTelegramRequest, UserResponse, UpdateScheduleRequest,
    UpdateProfileRequest
)
from auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])
profile_router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    email = req.email.lower().strip()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(req.password),
        timezone=req.timezone,
        study_schedule=req.study_schedule,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_token(str(user.id))
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    email = req.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        # Constant-time: still run bcrypt to prevent timing-based user enumeration
        # This is a pre-computed bcrypt hash of "dummy" — the value doesn't matter,
        # we just need bcrypt to run so the response time is indistinguishable.
        _dummy_hash = "$2b$12$YUio9T2I8Hjf/nw/Pi2hO.cJb/o7sHMtJJc8ClMMbk98KkWqKBuDS"
        verify_password(req.password, _dummy_hash)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(str(user.id))
    return TokenResponse(access_token=token)


@router.post("/link-telegram")
async def link_telegram(
    req: LinkTelegramRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from services.scheduler import _bot_instance
    import logging

    user.telegram_chat_id = req.telegram_chat_id
    await db.commit()
    
    # Notify the user on Telegram
    if _bot_instance:
        try:
            await _bot_instance.send_message(
                chat_id=req.telegram_chat_id,
                text=(
                    f"✅ *Your Telegram is successfully connected!*\n\n"
                    f"Hey there, and welcome to Axiom AI's Neural Bridge.\n"
                    f"You'll now receive your scheduled study nudges and can start "
                    f"Sudden Death quizzes right from here.\n\n"
                    f"Type /info to get more information."
                ),
                parse_mode="Markdown",
            )
        except Exception as e:
            logging.getLogger("axiom.users").error(f"Failed to send Telegram connection message: {e}")

    return {"message": "Telegram linked successfully", "chat_id": req.telegram_chat_id}


# --- Profile ---
@profile_router.get("/me", response_model=UserResponse)
async def get_profile(user: User = Depends(get_current_user)):
    return user


@profile_router.put("/schedule")
async def update_schedule(
    req: UpdateScheduleRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.timezone = req.timezone
    user.study_schedule = req.study_schedule
    await db.commit()
    return {"message": "Schedule updated", "schedule": req.study_schedule, "timezone": req.timezone}


@profile_router.patch("/profile", response_model=UserResponse)
async def update_profile(
    req: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.full_name is not None:
        user.full_name = req.full_name
    await db.commit()
    await db.refresh(user)
    return user


@profile_router.post("/profile/image")
async def upload_profile_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File provided is not an image.")

    # Create static/profiles directory if not exists
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    static_dir = os.path.join(base_dir, "static", "profiles")
    os.makedirs(static_dir, exist_ok=True)

    # Save file
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    file_name = f"{user.id}.{file_extension}"
    file_path = os.path.join(static_dir, file_name)

    content = await file.read()
    with open(file_path, 'wb') as out_file:
        out_file.write(content)

    # Update user
    user.profile_image_url = f"/static/profiles/{file_name}"
    await db.commit()

    return {"message": "Profile image updated successfully", "profile_image_url": user.profile_image_url}
