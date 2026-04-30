from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload, joinedload
import uuid

from database import get_db
from models import User, SocialPost, Goal, PostLike, SocialComment
from schemas import PostCreateRequest, PostResponse, CommentCreateRequest, CommentResponse
from auth import get_current_user
from fastapi.encoders import jsonable_encoder
from routers.social_ws import manager

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
    
    # Attach info for response
    post.user_email = user.email
    post.user_full_name = user.full_name
    post.user_profile_image = user.profile_image_url
    post.likes_count = 0
    post.comments_count = 0
    post.is_liked_by_me = False
    
    # Broadcast new post
    await manager.broadcast({
        "type": "new_post",
        "post": jsonable_encoder(PostResponse.from_orm(post))
    })
    
    return post

@router.get("/feed", response_model=list[PostResponse])
async def get_feed(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=50, description="Max posts to return (1-50)"),
):
    result = await db.execute(
        select(SocialPost)
        .options(
            selectinload(SocialPost.user),
            selectinload(SocialPost.likes),
            selectinload(SocialPost.comments)
        )
        .order_by(SocialPost.created_at.desc())
        .limit(limit)
    )
    posts = result.scalars().all()
    
    # Map additional fields
    for p in posts:
        p.user_email = p.user.email
        p.user_full_name = p.user.full_name
        p.user_profile_image = p.user.profile_image_url
        p.likes_count = len(p.likes)
        p.comments_count = len(p.comments)
        p.is_liked_by_me = any(like.user_id == user.id for like in p.likes)
        
    return posts


@router.post("/posts/{post_id}/toggle-like")
async def toggle_like(
    post_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check if like exists
    stmt = select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user.id)
    result = await db.execute(stmt)
    like = result.scalar_one_or_none()
    
    if like:
        await db.delete(like)
        liked = False
    else:
        new_like = PostLike(post_id=post_id, user_id=user.id)
        db.add(new_like)
        liked = True
        
    await db.commit()
    
    # Get updated count
    count_stmt = select(func.count(PostLike.id)).where(PostLike.post_id == post_id)
    count_res = await db.execute(count_stmt)
    likes_count = count_res.scalar()
    
    # Broadcast like update
    await manager.broadcast({
        "type": "like_update",
        "post_id": str(post_id),
        "likes_count": likes_count
    })
    
    return {"liked": liked, "likes_count": likes_count}


@router.get("/posts/{post_id}/comments", response_model=list[CommentResponse])
async def get_comments(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SocialComment)
        .options(joinedload(SocialComment.user))
        .where(SocialComment.post_id == post_id)
        .order_by(SocialComment.created_at.asc())
    )
    comments = result.scalars().all()
    
    for c in comments:
        c.user_full_name = c.user.full_name
        c.user_profile_image = c.user.profile_image_url
        
    return comments


@router.post("/posts/{post_id}/comments", response_model=CommentResponse)
async def add_comment(
    post_id: uuid.UUID,
    req: CommentCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comment = SocialComment(
        post_id=post_id,
        user_id=user.id,
        content=req.content
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    
    # Reload with user info
    result = await db.execute(
        select(SocialComment)
        .options(joinedload(SocialComment.user))
        .where(SocialComment.id == comment.id)
    )
    comment = result.scalar_one()
    comment.user_full_name = user.full_name
    comment.user_profile_image = user.profile_image_url
    
    # Broadcast new comment
    await manager.broadcast({
        "type": "new_comment",
        "post_id": str(post_id),
        "comment": jsonable_encoder(CommentResponse.from_orm(comment))
    })
    
    return comment
