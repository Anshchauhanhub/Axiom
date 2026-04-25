from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db
from models import User, SocialPost, Goal
from schemas import PostCreateRequest, PostResponse
from auth import get_current_user

router = APIRouter(prefix="/social", tags=["Social Feed"])

@router.post("/", response_model=PostResponse)
async def create_post(
    req: PostCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = SocialPost(
        user_id=user.id,
        goal_id=req.goal_id,
        content=req.content,
        post_type=req.post_type
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    
    # Attach email for response
    post.user_email = user.email
    return post

@router.get("/feed", response_model=list[PostResponse])
async def get_feed(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=50, description="Max posts to return (1-50)"),
):
    result = await db.execute(
        select(SocialPost)
        .options(selectinload(SocialPost.user))
        .order_by(SocialPost.created_at.desc())
        .limit(limit)
    )
    posts = result.scalars().all()
    
    # Map user emails
    for p in posts:
        p.user_email = p.user.email
        
    return posts
