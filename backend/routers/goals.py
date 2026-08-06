from auth import logger
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, text
from sqlalchemy.orm import selectinload

from database import get_db
from models import User, Goal, Task, Part, ChatMessage, ChatSession, RoadmapTemplate
from schemas import (
    CreateGoalRequest, GoalResponse, RoadmapResponse, TaskResponse, PartResponse,
    PartContentResponse, OnboardingChatRequest, OnboardingChatResponse, FinalizeGoalRequest,
    UpdateNotesRequest, YoutubeRoadmapRequest, YoutubeRoadmapResponse, CalendarTaskResponse,
    CacheStatsResponse
)
from auth import get_current_user
from services.groq import generate_roadmap, generate_roadmap_from_playlist
from services.synthesis import synthesize_part_content
from services.youtube import get_playlist_data
from services.roadmap_cache import check_cache, save_to_cache, invalidate_template
from services.timetable import personalize_pacing, generate_schedule_dates
from services.goal_agent import run_goal_agent

router = APIRouter(prefix="/goals", tags=["Goals & Roadmap"])

import pytz
from datetime import timedelta

def generate_schedule(settings: dict, user_timezone: str, num_parts: int) -> list[datetime]:
    study_days = settings.get("study_days", [1, 2, 3, 4, 5]) # 0=Sun, 1=Mon
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
                
                # If it's today, only schedule if it's in the future, unless we already moved to future days
                if dt > now or len(schedules) > 0 or current_date > now.date():
                    schedules.append(dt)
                    if len(schedules) == num_parts:
                        break
        current_date += timedelta(days=1)
        
    return schedules

@router.post("/", response_model=GoalResponse)
async def create_goal(
    req: CreateGoalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    goal = Goal(user_id=user.id, title=req.title, status="active")
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

    # Generate roadmap via Groq
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
        goal=GoalResponse(id=goal.id, title=goal.title, status=goal.status, notes=goal.notes),
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
        goal=GoalResponse(id=goal.id, title=goal.title, status=goal.status, notes=goal.notes),
        tasks=tasks_out,
    )


@router.get("/all-tasks", response_model=list[CalendarTaskResponse])
async def get_all_tasks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Part)
        .join(Task)
        .join(Goal)
        .options(
            selectinload(Part.task).selectinload(Task.goal),
            selectinload(Part.quiz_results)
        )
        .where(Goal.user_id == user.id)
    )
    parts = result.scalars().all()
    
    response = []
    for p in parts:
        completed_date = None
        for qr in p.quiz_results:
            if qr.is_passed:
                completed_date = qr.completed_at
        
        response.append({
            "id": str(p.id),
            "title": p.title,
            "status": p.status,
            "task_title": p.task.title,
            "goal_title": p.task.goal.title,
            "goal_id": str(p.task.goal.id),
            "completed_at": completed_date,
            "scheduled_at": p.scheduled_at
        })
    return response

@router.get("/", response_model=list[GoalResponse])
async def list_goals(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Goal).where(Goal.user_id == user.id))
    goals = result.scalars().all()
    
    return goals


@router.get("/chat-sessions")
async def get_chat_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    return {"sessions": sessions}


@router.get("/chat-sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id, ChatMessage.user_id == user.id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()
    return {"messages": [{"role": m.role, "content": m.content, "id": str(m.id)} for m in messages]}


@router.delete("/chat-sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import delete
    await db.execute(
        delete(ChatSession)
        .where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    await db.commit()
    return {"message": "Chat session deleted"}


@router.post("/chat")
async def onboarding_chat(
    req: OnboardingChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import logging
    logger = logging.getLogger("edxiom.chat")
    
    try:
        session_id = req.session_id
        
        # If no session_id, create a new session
        if not session_id:
            title_text = req.messages[-1].content[:30] + ("..." if len(req.messages[-1].content) > 30 else "")
            new_session = ChatSession(user_id=user.id, title=title_text)
            db.add(new_session)
            await db.commit()
            await db.refresh(new_session)
            session_id = str(new_session.id)
        else:
            # Update the updated_at timestamp of the session
            await db.execute(
                update(ChatSession)
                .where(ChatSession.id == session_id)
                .values(updated_at=datetime.now(timezone.utc))
            )
            
        # 1. Save the new user message to DB
        user_msg = ChatMessage(
            session_id=session_id,
            user_id=user.id,
            role="user",
            content=req.messages[-1].content
        )
        db.add(user_msg)
        await db.commit()

        # 2. Fetch goal context and schedule
        goal_result = await db.execute(
            select(Goal).where(Goal.user_id == user.id)
        )
        all_goals = goal_result.scalars().all()
        
        active_goals = [g.title for g in all_goals if g.status == "active"]
        paused_goals = [g.title for g in all_goals if g.status == "paused"]
        
        goal_context_lines = []
        if active_goals:
            goal_context_lines.append(f"Active goals: {', '.join(active_goals)}")
        if paused_goals:
            goal_context_lines.append(f"Paused goals: {', '.join(paused_goals)}")
            
        if not active_goals and not paused_goals:
            goal_context_lines.append("No active or paused goals yet.")
            
        schedule = user.study_schedule if user.study_schedule else ["None set"]
        goal_context_lines.append(f"User's study schedule (times): {', '.join(schedule)}")
        
        goal_context = "\n".join(goal_context_lines)

        # Append persistent study profile to context
        user_study_profile = user.study_profile if user.study_profile else {}
        profile_lines = []
        for k, v in user_study_profile.items():
            profile_lines.append(f"- {k.replace('_', ' ').title()}: {v}")
        profile_summary = "\n".join(profile_lines) if profile_lines else "No persistent profile facts registered yet."
        goal_context = f"{goal_context}\n\n### PERSISTENT USER MEMORY:\n{profile_summary}"

        # 3. Fetch last 15 messages for context
        history_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id, ChatMessage.user_id == user.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(15)
        )
        history_msgs = history_result.scalars().all()
        history_msgs.reverse()  # Chronological order

        # 4. Format messages for LLM
        formatted_messages = [
            {"role": m.role, "content": m.content}
            for m in history_msgs
        ]

        # 5. Generate AI response
        from services.groq import generate_onboarding_response
        response_data = await generate_onboarding_response(formatted_messages, goal_context=goal_context)
        response_data["session_id"] = session_id

        # Update user's study profile if model returned any updates
        profile_update = response_data.get("study_profile_update")
        if profile_update and isinstance(profile_update, dict):
            updated_profile = {**user_study_profile, **profile_update}
            updated_profile = {k: v for k, v in updated_profile.items() if v not in (None, "None")}
            user.study_profile = updated_profile
            db.add(user)
            await db.commit()
            logger.info(f"💾 Updated study profile persistent memory for user {user.id}: {updated_profile}")

        # 5.5. AGENTIC ROADMAP OVERRIDE — if the chat produced a draft roadmap,
        # re-generate it through the full agentic pipeline (entity detection →
        # deep web search → grounded generation → verification → YouTube videos).
        # This prevents the LLM from hallucinating exam syllabi (e.g. GATE DA ≠ Architecture).
        if response_data.get("phase") in ("draft", "ready") and response_data.get("goal_title"):
            try:
                goal_title = response_data["goal_title"]
                logger.info(f"🔄 Agentic override: regenerating roadmap for '{goal_title}' via pipeline")
                
                agent_state = await run_goal_agent(
                    user_id=str(user.id),
                    raw_goal=goal_title,
                    clarification_reply="beginner, no specific deadline",
                )
                
                if agent_state.get("verified_syllabus") and not agent_state.get("error"):
                    response_data["draft_roadmap"] = agent_state["verified_syllabus"]
                    logger.info(
                        f"✅ Agentic override success: {len(agent_state['verified_syllabus'])} tasks, "
                        f"entity={agent_state.get('detected_entity', 'none')}"
                    )
                else:
                    logger.warning(f"Agentic override failed, keeping chat-generated roadmap: {agent_state.get('error')}")
            except Exception as e:
                logger.warning(f"Agentic roadmap override error (keeping chat draft): {e}")

        # 6. Save AI response to DB
        assistant_msg = ChatMessage(
            session_id=session_id,
            user_id=user.id,
            role="assistant",
            content=response_data["message"]
        )
        db.add(assistant_msg)
        await db.commit()

        return response_data
    
    except Exception as e:
        logger.error(f"Chat endpoint error: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again later.")


@router.post("/youtube-roadmap", response_model=YoutubeRoadmapResponse)
async def generate_youtube_roadmap(
    req: YoutubeRoadmapRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch a YouTube playlist, extract videos, and generate a roadmap using LLM.
    """
    # 1. Scrape YouTube
    playlist_data = await get_playlist_data(req.url)
    if not playlist_data:
        raise HTTPException(status_code=400, detail="Failed to extract data from the provided YouTube playlist URL. Ensure it is a public playlist.")

    # 2. Generate Roadmap from videos
    try:
        synthesis_result = await generate_roadmap_from_playlist(
            playlist_data["title"], 
            playlist_data["videos"]
        )
        return YoutubeRoadmapResponse(
            draft_roadmap=synthesis_result["roadmap"],
            goal_title=synthesis_result["goal_title"]
        )
    except Exception as e:
        import logging
        logging.getLogger("edxiom.goals").error(f"Playlist roadmap generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to synthesize roadmap from playlist.")


@router.post("/finalize", response_model=RoadmapResponse)
async def finalize_goal(
    req: FinalizeGoalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # ── Write this roadmap back into the cache for future users ───────
    template_id = await save_to_cache(req.title, req.roadmap, db)

    # ── Create Goal with cache linkage ────────────────────────────────
    goal = Goal(
        user_id=user.id,
        title=req.title,
        status="active",
        settings=req.settings or {},
        template_id=template_id,
        cache_hit=False,  # This was a fresh generation that's now being cached
    )
    db.add(goal)
    await db.flush()

    # ── Schedule with arithmetic timetable engine ─────────────────────
    settings = req.settings or {}
    total_parts = sum(len(task_data.get("parts", [])) for task_data in req.roadmap)
    schedules = generate_schedule_dates(
        num_parts=total_parts,
        study_days=settings.get("study_days"),
        study_sessions=settings.get("study_sessions"),
        user_timezone=user.timezone,
    )
    schedule_idx = 0

    # ── Create Tasks & Parts from the approved draft ──────────────────
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
            part_schedule = schedules[schedule_idx] if schedule_idx < len(schedules) else None
            schedule_idx += 1
            
            part = Part(
                task_id=task.id,
                title=part_title,
                order_index=pidx,
                status="active" if idx == 0 and pidx == 0 else "locked",
                scheduled_at=part_schedule
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
        goal=GoalResponse(
            id=goal.id, title=goal.title, status=goal.status,
            notes=goal.notes, cache_hit=goal.cache_hit, template_id=goal.template_id
        ),
        tasks=tasks_out,
    )

@router.post("/quick-activate", response_model=RoadmapResponse)
async def quick_activate(
    req: CreateGoalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Check for existing goal with same title (per-user dedup)
    existing_result = await db.execute(
        select(Goal).where(Goal.user_id == user.id, Goal.title == req.title)
    )
    existing_goal = existing_result.scalar_one_or_none()
    
    if existing_goal:
        existing_goal.status = "active"
        await db.commit()
        return await get_roadmap(str(existing_goal.id), user, db)

    # ── 2. AGENTIC CACHE CHECK — two-tier lookup before burning an LLM call ──
    cache_result = await check_cache(req.title, db)
    template_id = None
    is_cache_hit = False

    if cache_result["tier"] in ("exact", "semantic"):
        # Cache hit — clone the template, personalize pacing
        import json
        cached_syllabus = cache_result["template"]["syllabus_json"]
        if isinstance(cached_syllabus, str):
            cached_syllabus = json.loads(cached_syllabus)

        roadmap_data = personalize_pacing(
            cached_syllabus,
            user_timezone=user.timezone,
        )
        template_id = str(cache_result["template"]["id"])
        is_cache_hit = True
        logger.info(f"⚡ Cache {cache_result['tier']} hit (score={cache_result.get('score', 1.0):.3f}). Skipping LLM call.")
    else:
        # Cache miss — run the full agentic pipeline
        try:
            agent_state = await run_goal_agent(
                user_id=str(user.id),
                raw_goal=req.title,
            )

            if agent_state.get("needs_clarification"):
                # For quick-activate, we skip clarification and just generate
                agent_state = await run_goal_agent(
                    user_id=str(user.id),
                    raw_goal=req.title,
                    clarification_reply="beginner, no specific deadline",
                )

            if agent_state.get("error") or not agent_state.get("verified_syllabus"):
                raise ValueError(agent_state.get("error", "No syllabus generated"))

            roadmap_data = agent_state["verified_syllabus"]

            # Write back to cache for future users (with entity + verification metadata)
            template_id = await save_to_cache(
                req.title, roadmap_data, db,
                detected_entity=agent_state.get("detected_entity"),
                verification_passed=agent_state.get("verification_passed", True),
            )

        except Exception as e:
            logger.error(f"Agentic roadmap generation failed: {e}", exc_info=True)
            await db.rollback()
            raise HTTPException(status_code=500, detail="Failed to generate roadmap. Please try again later.")

    # ── 3. Create Goal with cache tracking ────────────────────────────
    goal = Goal(
        user_id=user.id,
        title=req.title,
        status="active",
        template_id=template_id,
        cache_hit=is_cache_hit,
    )
    db.add(goal)
    await db.flush()

    # ── 4. Schedule with arithmetic timetable engine ──────────────────
    total_parts = sum(len(task_data.get("parts", [])) for task_data in roadmap_data)
    schedules = generate_schedule_dates(
        num_parts=total_parts,
        user_timezone=user.timezone,
    )
    schedule_idx = 0

    # ── 5. Create Tasks and Parts ─────────────────────────────────────
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
            part_schedule = schedules[schedule_idx] if schedule_idx < len(schedules) else None
            schedule_idx += 1
            
            part = Part(
                task_id=task.id,
                title=part_title,
                order_index=pidx,
                status="active" if idx == 0 and pidx == 0 else "locked",
                scheduled_at=part_schedule
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
        goal=GoalResponse(
            id=goal.id, title=goal.title, status=goal.status,
            notes=goal.notes, cache_hit=goal.cache_hit, template_id=goal.template_id
        ),
        tasks=tasks_out,
    )

@router.post("/{goal_id}/activate", response_model=RoadmapResponse)
async def activate_existing_goal(
    goal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 2. Find and activate target
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal.status = "active"
    await db.commit()

    # 3. Return roadmap
    return await get_roadmap(goal_id, user, db)

@router.delete("/{goal_id}", response_model=dict)
async def delete_goal(
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

    await db.delete(goal)
    await db.commit()
    return {"message": "Goal deleted", "id": goal_id}

@router.post("/{goal_id}/toggle", response_model=GoalResponse)
async def toggle_goal_status(
    goal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Find goal
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if goal.status == "active":
        # Just pause it
        goal.status = "paused"
    else:
        # Activate this
        goal.status = "active"

    await db.commit()
    await db.refresh(goal)
    return goal


@router.get("/parts/{part_id}/content", response_model=PartContentResponse)
async def get_part_content(
    part_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch the synthesized documentation for a roadmap part.
    Generates it via Neural Synthesis if not already present.
    Verifies the requesting user owns the parent goal.
    """
    # Join Part → Task → Goal and verify ownership
    result = await db.execute(
        select(Part)
        .join(Task, Part.task_id == Task.id)
        .join(Goal, Task.goal_id == Goal.id)
        .where(Part.id == part_id, Goal.user_id == user.id)
    )
    part = result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")

    # Check if content already exists
    if part.content:
        return PartContentResponse(
            part_id=part.id,
            title=part.title,
            content=part.content
        )

    # Trigger Generation
    try:
        content = await synthesize_part_content(part.title)
        part.content = content
        await db.commit()
        
        return PartContentResponse(
            part_id=part.id,
            title=part.title,
            content=content
        )
    except Exception as e:
        import logging
        logging.getLogger("edxiom.goals").error(f"Generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Content generation failed. Please try again later.")


@router.patch("/{goal_id}/notes", response_model=GoalResponse)
async def update_goal_notes(
    goal_id: str,
    req: UpdateNotesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal.notes = req.notes
    await db.commit()
    await db.refresh(goal)
    return goal


# ── Agentic System: Cache Analytics & Management ─────────────────────

@router.get("/cache/stats", response_model=CacheStatsResponse)
async def get_cache_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analytics: how much the roadmap cache is saving in LLM costs."""
    # Total goals
    total_result = await db.execute(select(func.count(Goal.id)))
    total_goals = total_result.scalar() or 0

    # Cache hits
    hit_result = await db.execute(
        select(func.count(Goal.id)).where(Goal.cache_hit == True)  # noqa: E712
    )
    cache_hits = hit_result.scalar() or 0
    cache_misses = total_goals - cache_hits

    hit_rate = (cache_hits / total_goals * 100) if total_goals > 0 else 0.0

    # Top templates by hit count
    top_result = await db.execute(
        select(RoadmapTemplate.goal_text, RoadmapTemplate.hit_count)
        .order_by(RoadmapTemplate.hit_count.desc())
        .limit(10)
    )
    top_templates = [
        {"goal_text": row[0], "hit_count": row[1]}
        for row in top_result.all()
    ]

    return CacheStatsResponse(
        total_goals=total_goals,
        cache_hits=cache_hits,
        cache_misses=cache_misses,
        hit_rate_percent=round(hit_rate, 1),
        top_templates=top_templates,
    )


@router.post("/cache/invalidate/{template_id}")
async def invalidate_cached_template(
    template_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Invalidate a bad roadmap template (cache poisoning protection).
    Called when a user thumbs-down a roadmap.
    """
    await invalidate_template(template_id, db)
    return {"message": "Template invalidated", "template_id": template_id}


@router.post("/tasks/{task_id}/unlock", response_model=RoadmapResponse)
async def unlock_task(
    task_id: str,
    use_credit: bool = True,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Fetch task with parts
    task_result = await db.execute(
        select(Task).where(Task.id == task_id).options(selectinload(Task.parts))
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Fetch goal and verify ownership
    goal_result = await db.execute(
        select(Goal).where(Goal.id == task.goal_id, Goal.user_id == user.id)
    )
    goal = goal_result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=403, detail="Not authorized to unlock this module")

    if task.status != "locked":
        # Already unlocked
        return await get_roadmap(str(goal.id), user, db)

    # Get user from DB to update credits
    user_db_result = await db.execute(
        select(User).where(User.id == user.id)
    )
    user_db = user_db_result.scalar_one()

    if use_credit:
        if user_db.credits < 1:
            raise HTTPException(status_code=400, detail="Insufficient credits. Watch an ad to earn credits or unlock directly.")
        user_db.credits -= 1

    # Unlock task
    task.status = "active"
    
    # Unlock all parts of this task
    for p in task.parts:
        p.status = "active"

    await db.commit()

    # Return updated roadmap
    return await get_roadmap(str(goal.id), user_db, db)

