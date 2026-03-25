"""
Service — Goal Generation.

Takes a user's goal + study parameters and calls the LLM to produce
a structured hierarchy: Goal → Tasks → Parts.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.client import generate_json_roadmap
from app.models.goal import Goal
from app.models.task import Task, TaskStatus
from app.models.part import Part, PartStatus
from app.models.user import User


async def generate_goal(
    user: User,
    title: str,
    total_days: int,
    syllabus_text: str,
    db: AsyncSession,
) -> Goal:
    """
    End-to-end goal creation:
      1. Call LLM with syllabus text for a structured plan.
      2. Persist Goal + child Tasks + grandchild Parts.
      3. Unlock the first task & its first part.
    """
    # ── 1. LLM call ────────────────────────────────────
    json_plan = await generate_json_roadmap(syllabus_text)

    # ── 2. Persist Goal ────────────────────────────────
    goal = Goal(
        user_id=user.id,
        title=title,
        total_days=total_days,
    )
    db.add(goal)
    await db.flush()

    # ── 3. Create Tasks + Parts from plan ──────────────
    chapters = json_plan.get("days", [])
    for i, chapter_data in enumerate(chapters):
        task = Task(
            goal_id=goal.id,
            title=chapter_data.get("title", f"Chapter {i + 1}"),
            order_index=i + 1,
            status=TaskStatus.ACTIVE if i == 0 else TaskStatus.LOCKED,
        )
        db.add(task)
        await db.flush()

        # Each chapter can have sub-topics (parts)
        subtopics = chapter_data.get("subtopics", [chapter_data.get("title", f"Part {i + 1}")])
        if isinstance(subtopics, str):
            subtopics = [subtopics]

        for j, subtopic in enumerate(subtopics):
            part_title = subtopic if isinstance(subtopic, str) else subtopic.get("title", f"Part {j + 1}")
            part = Part(
                task_id=task.id,
                title=part_title,
                status=PartStatus.ACTIVE if (i == 0 and j == 0) else PartStatus.LOCKED,
            )
            db.add(part)

    await db.flush()
    await db.refresh(goal)
    return goal
