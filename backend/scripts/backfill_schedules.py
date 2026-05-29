import asyncio
import sys
import os
import pytz
from datetime import datetime, timedelta, timezone
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import engine, async_session
from models import Goal, Task, Part

def generate_schedule(settings: dict, user_timezone: str, num_parts: int) -> list[datetime]:
    study_days = settings.get("study_days", [1, 2, 3, 4, 5])
    study_sessions = settings.get("study_sessions", ["18:00"])
    
    if not study_days or not study_sessions:
        study_days = [0,1,2,3,4,5,6]
        study_sessions = ["18:00"]
        
    try:
        tz = pytz.timezone(user_timezone)
    except Exception:
        tz = timezone.utc
        
    now = datetime.now(tz)
    current_date = now.date()
    
    sessions_sorted = sorted([datetime.strptime(s, "%H:%M").time() for s in study_sessions])
    schedules = []
    
    while len(schedules) < num_parts:
        frontend_day = (current_date.weekday() + 1) % 7
        if frontend_day in study_days:
            for s_time in sessions_sorted:
                try:
                    dt = tz.localize(datetime.combine(current_date, s_time))
                except Exception:
                    dt = datetime.combine(current_date, s_time).replace(tzinfo=tz)
                
                if dt > now or len(schedules) > 0 or current_date > now.date():
                    schedules.append(dt)
                    if len(schedules) == num_parts:
                        break
        current_date += timedelta(days=1)
    return schedules

async def backfill():
    async with async_session() as db:
        result = await db.execute(select(Goal).options(selectinload(Goal.tasks).selectinload(Task.parts)))
        goals = result.scalars().all()
        
        for goal in goals:
            total_parts = sum(len(task.parts) for task in goal.tasks)
            if total_parts == 0:
                continue
            
            schedules = generate_schedule(goal.settings or {}, "Asia/Kolkata", total_parts)
            schedule_idx = 0
            
            sorted_tasks = sorted(goal.tasks, key=lambda t: t.order_index)
            for task in sorted_tasks:
                sorted_parts = sorted(task.parts, key=lambda p: p.order_index)
                for part in sorted_parts:
                    if not part.scheduled_at:
                        part.scheduled_at = schedules[schedule_idx] if schedule_idx < len(schedules) else None
                    schedule_idx += 1
                    
        await db.commit()
        print("Successfully backfilled schedules for all existing goals!")

if __name__ == "__main__":
    asyncio.run(backfill())
