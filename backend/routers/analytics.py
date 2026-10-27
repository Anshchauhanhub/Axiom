from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from collections import defaultdict

from database import get_db
from models import User, StudySession, QuizResult, Part, Task, Goal
from auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/study-hours")
async def get_study_hours(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(weeks=12)
    
    result = await db.execute(
        select(StudySession.started_at, StudySession.duration_seconds)
        .where(
            StudySession.user_id == user.id,
            StudySession.started_at >= cutoff,
            StudySession.duration_seconds != None
        )
    )
    sessions = result.fetchall()
    
    weekly_data = defaultdict(float)
    
    for started_at, duration in sessions:
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        week_start = started_at - timedelta(days=started_at.weekday())
        week_str = week_start.strftime("%Y-%m-%d")
        weekly_data[week_str] += duration / 3600.0
        
    weeks = [{"week_start": k, "hours": round(v, 2)} for k, v in sorted(weekly_data.items())]
    return {"weeks": weeks}

@router.get("/quiz-scores")
async def get_quiz_scores(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(QuizResult, Part.title)
        .join(Part, QuizResult.part_id == Part.id)
        .where(QuizResult.user_id == user.id)
        .order_by(QuizResult.completed_at)
    )
    rows = result.fetchall()
    
    scores = []
    for q_res, p_title in rows:
        scores.append({
            "date": q_res.completed_at.isoformat(),
            "score": q_res.score_percent,
            "part_title": p_title
        })
    return {"scores": scores}

@router.get("/streak-history")
async def get_streak_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=365)
    
    quiz_res = await db.execute(
        select(func.date(QuizResult.completed_at), func.count(QuizResult.id))
        .where(QuizResult.user_id == user.id, QuizResult.completed_at >= cutoff)
        .group_by(func.date(QuizResult.completed_at))
    )
    quiz_counts = dict(quiz_res.fetchall())
    
    study_res = await db.execute(
        select(func.date(StudySession.started_at), func.count(StudySession.id))
        .where(StudySession.user_id == user.id, StudySession.started_at >= cutoff)
        .group_by(func.date(StudySession.started_at))
    )
    study_counts = dict(study_res.fetchall())
    
    activity_counts = defaultdict(int)
    for d, c in quiz_counts.items():
        if d:
            activity_counts[str(d)] += c
    for d, c in study_counts.items():
        if d:
            activity_counts[str(d)] += c
        
    days = []
    for d_str, count in sorted(activity_counts.items()):
        level = min(4, max(0, count)) 
        days.append({"date": d_str, "count": count, "level": level})
        
    return {"days": days}

@router.get("/completion-velocity")
async def get_completion_velocity(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(weeks=12)
    
    result = await db.execute(
        select(QuizResult.completed_at)
        .where(QuizResult.user_id == user.id, QuizResult.is_passed == True, QuizResult.completed_at >= cutoff)
    )
    completions = result.scalars().all()
    
    weekly_data = defaultdict(int)
    
    for completed_at in completions:
        if completed_at.tzinfo is None:
            completed_at = completed_at.replace(tzinfo=timezone.utc)
        week_start = completed_at - timedelta(days=completed_at.weekday())
        week_str = week_start.strftime("%Y-%m-%d")
        weekly_data[week_str] += 1
        
    weeks = [{"week_start": k, "parts_completed": v} for k, v in sorted(weekly_data.items())]
    return {"weeks": weeks}

@router.get("/summary")
async def get_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    study_res = await db.execute(
        select(func.sum(StudySession.duration_seconds)).where(StudySession.user_id == user.id)
    )
    total_seconds = study_res.scalar() or 0
    total_study_hours = round(total_seconds / 3600.0, 2)
    
    quiz_pass_res = await db.execute(
        select(func.count(QuizResult.id)).where(QuizResult.user_id == user.id, QuizResult.is_passed == True)
    )
    total_quizzes_passed = quiz_pass_res.scalar() or 0
    
    quiz_avg_res = await db.execute(
        select(func.avg(QuizResult.score_percent)).where(QuizResult.user_id == user.id)
    )
    avg_quiz_score = round(quiz_avg_res.scalar() or 0.0, 2)
    
    parts_res = await db.execute(
        select(func.count(Part.id))
        .join(Task, Part.task_id == Task.id)
        .join(Goal, Task.goal_id == Goal.id)
        .where(Goal.user_id == user.id, Part.status == 'passed')
    )
    total_parts_completed = parts_res.scalar() or 0
    
    return {
        "total_study_hours": total_study_hours,
        "total_quizzes_passed": total_quizzes_passed,
        "total_parts_completed": total_parts_completed, 
        "current_streak": user.current_streak,
        "longest_streak": user.current_streak,
        "avg_quiz_score": avg_quiz_score
    }
