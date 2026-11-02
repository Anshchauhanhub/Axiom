"""
Learning Context Engine — Edxiom's RAG & Context Builder.

Analogous to the medical-knowledge.ts context engine in the described architecture.

Replaces the ad-hoc goal_context string assembled inline in goals.py.
Provides a structured LearningContext object that powers:
  - Personalized system prompt construction
  - AI awareness of user's exact position in their roadmap
  - Urgency calibration from study_profile (days until exam, daily hours)
  - Entity-grounded syllabus injection
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

logger = logging.getLogger("edxiom.learning_context")


# ── Context Data Object ───────────────────────────────────────────────

@dataclass
class LearningContext:
    """
    A fully structured snapshot of a user's learning state.
    Passed to build_system_prompt() to construct the LLM system prompt.
    """
    # Goal & roadmap position
    active_goal_title: Optional[str] = None
    active_goal_id: Optional[str] = None
    current_task_title: Optional[str] = None       # Module they're currently on
    current_part_title: Optional[str] = None       # Specific segment/subtopic
    total_tasks: int = 0
    completed_tasks: int = 0
    syllabus_summary: list[str] = field(default_factory=list)  # All task titles

    # Entity awareness (exam/certification)
    exam_entity: Optional[str] = None              # e.g. "GATE DA", "AWS SAA-C03"
    exam_key_topics: list[str] = field(default_factory=list)

    # Study profile (persistent memory from JSONB column)
    target_exam: Optional[str] = None
    months_remaining: Optional[float] = None
    study_hours_per_day: Optional[float] = None
    preferred_language: Optional[str] = None
    preferred_youtubers: Optional[str] = None
    learning_style: Optional[str] = None

    # Computed urgency metrics
    days_until_exam: Optional[int] = None
    total_study_hours_left: Optional[float] = None
    completion_percent: float = 0.0

    # Raw profile (for fallback)
    raw_study_profile: dict = field(default_factory=dict)

    # All active + paused goals (for multi-goal awareness)
    all_goal_titles: list[str] = field(default_factory=list)
    all_goal_summaries: list[dict] = field(default_factory=list)

    # Personal calendar events
    personal_events: list[str] = field(default_factory=list)


# ── Context Builder ───────────────────────────────────────────────────

async def build_learning_context(user, db: AsyncSession) -> LearningContext:
    """
    Build a fully populated LearningContext for a user.

    Queries:
    - Active goals and their task/part hierarchy
    - User's study_profile JSONB
    - RoadmapTemplate.detected_entity for entity-grounded context

    Returns a LearningContext dataclass — never raises, degrades gracefully.
    """
    ctx = LearningContext()

    try:
        from models import Goal, Task, Part, RoadmapTemplate

        # ── 1. Load all user goals ────────────────────────────────────
        goals_result = await db.execute(
            select(Goal)
            .where(Goal.user_id == user.id)
            .options(
                selectinload(Goal.tasks).selectinload(Task.parts),
                selectinload(Goal.template),
            )
        )
        all_goals = goals_result.scalars().all()

        ctx.all_goal_titles = [g.title for g in all_goals]

        # Populate detailed summaries for ALL user goals
        for g in all_goals:
            sorted_t = sorted(g.tasks, key=lambda t: t.order_index)
            done_cnt = len([t for t in sorted_t if t.status == "passed"])
            curr_task = next((t.title for t in sorted_t if t.status == "active"), "Completed" if done_cnt == len(sorted_t) and sorted_t else "Locked")
            ctx.all_goal_summaries.append({
                "title": g.title,
                "status": g.status,
                "total_tasks": len(sorted_t),
                "completed_tasks": done_cnt,
                "current_module": curr_task,
                "module_titles": [t.title for t in sorted_t[:8]]
            })

        active_goals = [g for g in all_goals if g.status == "active"]
        if not active_goals:
            logger.info(f"No active goals for user {user.id}")
        else:
            # Use the most recently created active goal as "primary"
            primary_goal = active_goals[0]
            ctx.active_goal_title = primary_goal.title
            ctx.active_goal_id = str(primary_goal.id)

            # ── 2. Extract roadmap position ───────────────────────────
            sorted_tasks = sorted(primary_goal.tasks, key=lambda t: t.order_index)
            ctx.total_tasks = len(sorted_tasks)
            ctx.syllabus_summary = [t.title for t in sorted_tasks]

            completed = [t for t in sorted_tasks if t.status == "passed"]
            ctx.completed_tasks = len(completed)
            ctx.completion_percent = (len(completed) / max(len(sorted_tasks), 1)) * 100

            # Find the currently active task (first non-passed)
            active_task = next((t for t in sorted_tasks if t.status == "active"), None)
            if active_task:
                ctx.current_task_title = active_task.title
                sorted_parts = sorted(active_task.parts, key=lambda p: p.order_index)
                active_part = next((p for p in sorted_parts if p.status == "active"), None)
                if active_part:
                    # Strip video_id from part title if present
                    clean_part = active_part.title.split(" || ")[0].strip() if " || " in active_part.title else active_part.title
                    ctx.current_part_title = clean_part

            # ── 3. Entity awareness from RoadmapTemplate ──────────────
            if primary_goal.template and primary_goal.template.detected_entity:
                ctx.exam_entity = primary_goal.template.detected_entity
                # Load key topics from registry
                try:
                    from services.exam_resolver import EXAM_REGISTRY
                    matched = next(
                        (e for e in EXAM_REGISTRY if e.canonical_name == ctx.exam_entity),
                        None
                    )
                    if matched:
                        ctx.exam_key_topics = matched.key_topics
                except Exception:
                    pass

        # ── 4. Study profile extraction ───────────────────────────────
        profile = user.study_profile or {}
        ctx.raw_study_profile = profile

        ctx.target_exam = profile.get("target_exam")
        ctx.preferred_language = profile.get("preferred_language", "English")
        ctx.preferred_youtubers = profile.get("preferred_youtubers")
        ctx.learning_style = profile.get("learning_style")

        # Parse numeric fields safely
        try:
            raw_months = profile.get("months_remaining")
            if raw_months is not None:
                ctx.months_remaining = float(raw_months)
                ctx.days_until_exam = int(ctx.months_remaining * 30)
        except (ValueError, TypeError):
            pass

        try:
            raw_hours = profile.get("study_hours_per_day")
            if raw_hours is not None:
                ctx.study_hours_per_day = float(raw_hours)
        except (ValueError, TypeError):
            pass

        # ── 5. Compute urgency metrics ────────────────────────────────
        if ctx.days_until_exam and ctx.study_hours_per_day:
            ctx.total_study_hours_left = ctx.days_until_exam * ctx.study_hours_per_day

        # ── 6. Load user's personal calendar events ───────────────────
        try:
            from models import PersonalTask
            from zoneinfo import ZoneInfo
            user_tz = ZoneInfo(getattr(user, "timezone", None) or "Asia/Kolkata")
            pt_res = await db.execute(
                select(PersonalTask).where(
                    PersonalTask.user_id == user.id,
                    PersonalTask.status.in_(["active", "pending"])
                ).order_by(PersonalTask.scheduled_at.asc()).limit(15)
            )
            for pt in pt_res.scalars().all():
                if pt.scheduled_at:
                    local_time = pt.scheduled_at.astimezone(user_tz).strftime("%A, %b %d at %I:%M %p")
                    ctx.personal_events.append(f"'{pt.title}' ({local_time})")
                else:
                    ctx.personal_events.append(f"'{pt.title}' (Unscheduled)")
        except Exception as pte:
            logger.warning(f"Could not load personal tasks for context: {pte}")

        logger.info(
            f"✅ LearningContext built: goal='{ctx.active_goal_title}', "
            f"entity='{ctx.exam_entity}', task='{ctx.current_task_title}', "
            f"completion={ctx.completion_percent:.1f}%, days_left={ctx.days_until_exam}, "
            f"personal_events={len(ctx.personal_events)}"
        )

    except Exception as e:
        logger.error(f"❌ LearningContext build failed (returning empty context): {e}", exc_info=True)

    return ctx


# ── System Prompt Builder ─────────────────────────────────────────────

def build_goal_context_string(ctx: LearningContext) -> str:
    """
    Convert a LearningContext into the rich goal_context string that
    gets injected into the system prompt in generate_onboarding_response().
    """
    lines = []

    # Goal & progress
    if ctx.active_goal_title:
        lines.append(f"🎯 Primary Active Goal: {ctx.active_goal_title}")
        lines.append(f"📊 Progress: {ctx.completion_percent:.0f}% complete ({ctx.completed_tasks}/{ctx.total_tasks} modules passed)")
    else:
        lines.append("No active goal yet — user is in onboarding phase.")

    # Current position
    if ctx.current_task_title:
        lines.append(f"📍 Current Module: {ctx.current_task_title}")
    if ctx.current_part_title:
        lines.append(f"🔖 Current Subtopic: {ctx.current_part_title}")

    # Syllabus overview
    if ctx.syllabus_summary:
        syllabus_text = ", ".join(ctx.syllabus_summary[:8])
        if len(ctx.syllabus_summary) > 8:
            syllabus_text += f" ... (+{len(ctx.syllabus_summary) - 8} more)"
        lines.append(f"📚 Syllabus Modules: {syllabus_text}")

    # Entity context
    if ctx.exam_entity:
        lines.append(f"🎓 Target Exam: {ctx.exam_entity}")
        if ctx.exam_key_topics:
            lines.append(f"📋 Official Core Topics: {', '.join(ctx.exam_key_topics)}")

    # Study profile urgency
    if ctx.months_remaining is not None:
        lines.append(f"⏰ Time Remaining: {ctx.months_remaining:.1f} months ({ctx.days_until_exam} days)")
    if ctx.study_hours_per_day:
        lines.append(f"⏱️ Daily Study Hours: {ctx.study_hours_per_day}h/day")
    if ctx.total_study_hours_left:
        lines.append(f"📈 Total Hours Remaining: ~{ctx.total_study_hours_left:.0f}h")
    if ctx.preferred_language and ctx.preferred_language.lower() in ("hinglish", "hindi"):
        lines.append(f"🌐 Preferred Language: English by default. (Only use {ctx.preferred_language} if the user explicitly asks for it in their current message).")
    else:
        lines.append("🌐 Language: English only. Use clear, simple, accessible English.")
    if ctx.preferred_youtubers:
        lines.append(f"📺 Preferred YouTubers: {ctx.preferred_youtubers}")

    # Persistent profile (remaining fields)
    profile_extras = {
        k: v for k, v in ctx.raw_study_profile.items()
        if k not in ("target_exam", "months_remaining", "study_hours_per_day",
                     "preferred_language", "preferred_youtubers", "learning_style")
        and v not in (None, "None", "")
    }
    if profile_extras:
        lines.append("\n### Additional Profile Facts:")
        for k, v in profile_extras.items():
            lines.append(f"- {k.replace('_', ' ').title()}: {v}")

    # All goals breakdown — active, paused, and completed
    if ctx.all_goal_summaries:
        active_goals = [s for s in ctx.all_goal_summaries if s["status"] == "active"]
        paused_goals = [s for s in ctx.all_goal_summaries if s["status"] == "paused"]
        completed_goals = [s for s in ctx.all_goal_summaries if s["status"] in ("completed", "passed")]
        missed_goals = [
            s for s in ctx.all_goal_summaries
            if s["status"] == "active" and s["completed_tasks"] == 0 and s["total_tasks"] > 0
        ]

        lines.append("\n### ALL USER GOALS & ACCOUNT STATE:")

        if active_goals:
            lines.append("🟡 ACTIVE GOALS:")
            for s in active_goals:
                modules_str = ", ".join(s["module_titles"])
                if len(s["module_titles"]) < s["total_tasks"]:
                    modules_str += f" ... (+{s['total_tasks'] - len(s['module_titles'])} more)"
                pct = round(s["completed_tasks"] / max(s["total_tasks"], 1) * 100)
                lines.append(
                    f"  • '{s['title']}' — {pct}% done ({s['completed_tasks']}/{s['total_tasks']} modules passed) | "
                    f"Current Module: '{s['current_module']}'\n    Modules: {modules_str}"
                )

        if completed_goals:
            lines.append("✅ COMPLETED GOALS:")
            for s in completed_goals:
                lines.append(f"  • '{s['title']}' — FULLY COMPLETED ({s['completed_tasks']}/{s['total_tasks']} modules)")

        if paused_goals:
            lines.append("⏸️ PAUSED GOALS:")
            for s in paused_goals:
                pct = round(s["completed_tasks"] / max(s["total_tasks"], 1) * 100)
                lines.append(f"  • '{s['title']}' — {pct}% done, currently paused")

        if missed_goals:
            lines.append("⚠️ GOALS WITH ZERO PROGRESS (NOT STARTED / MISSED):")
            for s in missed_goals:
                lines.append(f"  • '{s['title']}' — 0 of {s['total_tasks']} modules started")

        # Streak info from raw_study_profile if available
        streak = ctx.raw_study_profile.get("current_streak")
        if streak is not None:
            lines.append(f"\n🔥 Current Study Streak: {streak} days")

    # Personal calendar events
    if ctx.personal_events:
        lines.append("\n### USER'S PERSONAL CALENDAR & SCHEDULED EVENTS:")
        for ev in ctx.personal_events:
            lines.append(f"  • 📅 {ev}")
    else:
        lines.append("\n### USER'S PERSONAL CALENDAR & SCHEDULED EVENTS:\n  • No personal events currently scheduled.")

    return "\n".join(lines)

