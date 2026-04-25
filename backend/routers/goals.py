from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db
from models import User, Goal, Task, Part, ChatMessage
from schemas import (
    CreateGoalRequest, GoalResponse, RoadmapResponse, TaskResponse, PartResponse,
    PartContentResponse, OnboardingChatRequest, OnboardingChatResponse, FinalizeGoalRequest,
    UpdateNotesRequest
)
from auth import get_current_user
from services.groq import generate_roadmap
from services.synthesis import synthesize_part_content

router = APIRouter(prefix="/goals", tags=["Goals & Roadmap"])
 
async def deactivate_all_goals(user_id, db: AsyncSession):
    from sqlalchemy import update, delete
    from models import Goal, ChatMessage
    
    # 1. Clear chat history so LLM memory is isolated to the new active session
    await db.execute(
        delete(ChatMessage)
        .where(ChatMessage.user_id == user_id)
    )
    
    # 2. Deactivate all goals
    await db.execute(
        update(Goal)
        .where(Goal.user_id == user_id)
        .values(status="paused")
        .execution_options(synchronize_session="fetch")
    )


@router.post("/", response_model=GoalResponse)
async def create_goal(
    req: CreateGoalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Deactivate others
    await deactivate_all_goals(user.id, db)
    await db.flush()

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


@router.get("/", response_model=list[GoalResponse])
async def list_goals(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Goal).where(Goal.user_id == user.id))
    goals = result.scalars().all()
    
    # Sanity check: Ensure only one is active
    active_goals = [g for g in goals if g.status == "active"]
    if len(active_goals) > 1:
        # Keep only the first one active, pause others
        keep_active = active_goals[0]
        await deactivate_all_goals(user.id, db)
        await db.flush()
        keep_active.status = "active"
        await db.commit()
    
    return goals


@router.get("/chat/history")
async def get_chat_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user.id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()
    return {"messages": [{"role": m.role, "content": m.content} for m in messages]}


@router.delete("/chat/history")
async def clear_chat_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Wipe all chat messages for the current user to start a fresh session."""
    from sqlalchemy import delete
    await db.execute(
        delete(ChatMessage)
        .where(ChatMessage.user_id == user.id)
    )
    await db.commit()
    return {"message": "Chat history cleared"}


@router.post("/chat")
async def onboarding_chat(
    req: OnboardingChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import logging
    logger = logging.getLogger("axiom.chat")
    
    try:
        # 1. Save the new user message to DB
        user_msg = ChatMessage(
            user_id=user.id,
            role="user",
            content=req.messages[-1].content
        )
        db.add(user_msg)
        await db.commit()

        # 2. Fetch active goal context
        goal_result = await db.execute(
            select(Goal).where(Goal.user_id == user.id, Goal.status == "active")
        )
        active_goal = goal_result.scalar_one_or_none()
        goal_context = f"Current active study goal: {active_goal.title}" if active_goal else "No active goal yet."

        # 3. Fetch last 15 messages for context
        history_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.user_id == user.id)
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

        # 6. Save AI response to DB
        assistant_msg = ChatMessage(
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


@router.post("/finalize", response_model=RoadmapResponse)
async def finalize_goal(
    req: FinalizeGoalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Deactivate other goals
    await deactivate_all_goals(user.id, db)
    await db.flush()

    # 2. Create Goal
    goal = Goal(user_id=user.id, title=req.title, status="active")
    db.add(goal)
    await db.flush()

    # 2. Create Tasks & Parts from the approved draft
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

@router.post("/{goal_id}/activate", response_model=RoadmapResponse)
@router.post("/quick-activate", response_model=RoadmapResponse)
async def quick_activate(
    req: CreateGoalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Check for existing goal with same title
    existing_result = await db.execute(
        select(Goal).where(Goal.user_id == user.id, Goal.title == req.title)
    )
    existing_goal = existing_result.scalar_one_or_none()

    # Deactivate others
    await deactivate_all_goals(user.id, db)
    await db.flush()
    
    if existing_goal:
        existing_goal.status = "active"
        await db.commit()
        # Return existing roadmap
        return await get_roadmap(str(existing_goal.id), user, db)

    # 2. Create the Goal
    goal = Goal(user_id=user.id, title=req.title, status="active")
    db.add(goal)
    await db.flush()

    # 2. Generate Roadmap using LLM
    try:
        roadmap_data = await generate_roadmap(goal.title)
    except Exception as e:
        logger.error(f"Roadmap generation failed: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to generate roadmap. Please try again later.")

    # 3. Create Tasks and Parts
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

async def activate_existing_goal(
    goal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Deactivate all
    await deactivate_all_goals(user.id, db)
    await db.flush()

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
        # Deactivate all others, then activate this
        await deactivate_all_goals(user.id, db)
        await db.flush()
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

    # Trigger Neural Synthesis
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
        logging.getLogger("axiom.goals").error(f"Neural Synthesis failed: {e}", exc_info=True)
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
