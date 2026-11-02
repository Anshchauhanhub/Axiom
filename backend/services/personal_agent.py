"""
personal_agent.py — Jarvis-Style Personal Assistant Engine for Exiom.

Capabilities:
  - schedule_task: Natural language calendar scheduling (UTC storage, user tz resolution)
  - cancel_task: Soft-cancel / undo scheduled task
  - adjust_study_schedule: Modify daily study session slots
  - get_daily_schedule: Unified view of today's study roadmap + personal tasks
  - get_accountability_status: Streak & pending goal/task audit
  - general_chat: Assistant conversation & study advice
"""

import re
import json
import inspect
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from zoneinfo import ZoneInfo
from dateutil import parser as dateutil_parser

from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

import models
from services.groq import call_groq, GROQ_MODEL_FAST

logger = logging.getLogger("edxiom.personal_agent")

# Sliding-window rate limit: user_id -> [timestamps]
_RATE_LIMITS: Dict[str, List[float]] = {}
MAX_CALLS_PER_HOUR = 30


def _check_rate_limit(user_id: str) -> bool:
    import time
    now = time.time()
    cutoff = now - 3600
    history = [t for t in _RATE_LIMITS.get(user_id, []) if t > cutoff]
    if len(history) >= MAX_CALLS_PER_HOUR:
        return False
    history.append(now)
    _RATE_LIMITS[user_id] = history
    return True


def get_user_zone(user: models.User) -> ZoneInfo:
    tz_str = getattr(user, "timezone", None) or "Asia/Kolkata"
    try:
        return ZoneInfo(tz_str)
    except Exception:
        return ZoneInfo("UTC")


SYSTEM_PROMPT = """You are Exiom AI Personal Assistant (Jarvis), a brilliant and dedicated executive assistant and study coach.
Analyze the user's message and recent conversation context, then return a STRICT single-line JSON object.

CAPABILITIES:
1. "schedule_task": User mentions or wants to schedule any personal event, meeting, tournament, match, study session, appointment, or reminder.
   - If recent conversation history is provided, resolve references from earlier messages! For example:
     - If you previously asked "What would you like to schedule at 6 pm?" and the user replies "for gaming tournament" or "study", combine them into title: "Gaming Tournament" (or "Study Session"), time_str: "6:00 PM", date_str: "today", clarification_needed: false.
     - If you asked "When would you like to schedule the tournament?" and the user replies "at 6pm", combine them into title: "Tournament", time_str: "6:00 PM", date_str: "today", clarification_needed: false.
   Examples:
   - "schedule my meet at 6 pm" -> action: "schedule_task", title: "Meeting", date_str: "today", time_str: "6:00 pm"
   - "schedule my time at 6 pm for study" -> action: "schedule_task", title: "Study Session", date_str: "today", time_str: "6:00 pm"
   - "i have a tournament at 6pm of football" -> action: "schedule_task", title: "Football Tournament", date_str: "today", time_str: "6:00 pm"
   - "football match at 5" -> action: "schedule_task", title: "Football Match", date_str: "today", time_str: "5:00 pm"
   - "doctor appointment tomorrow at 10am" -> action: "schedule_task", title: "Doctor Appointment", date_str: "tomorrow", time_str: "10:00 am"
   - "gym at 7pm" -> action: "schedule_task", title: "Gym Session", date_str: "today", time_str: "7:00 pm"
2. "cancel_task": User wants to cancel or delete an event or task.
   Example: "cancel my 6pm meeting", "cancel football tournament", "delete the math task"
3. "adjust_study_schedule": User wants to change daily study session times.
   Example: "adjust my study time to 8pm", "change my study sessions to 14:00 and 20:00"
4. "get_daily_schedule": User asks what is on their schedule, agenda, or today's tasks.
   Example: "what's on my schedule today?", "what are my tasks for today?"
5. "get_accountability_status": User asks about pending work, missed tasks, passed goals, or streak.
   Example: "did I miss any tasks?", "what goals did I pass?", "how is my streak?"
6. "general_chat": Conversational questions, greetings, or learning queries.

OUTPUT JSON SCHEMA:
{
  "action": "schedule_task" | "cancel_task" | "adjust_study_schedule" | "get_daily_schedule" | "get_accountability_status" | "general_chat",
  "title": "Clean, concise title of task/meeting (e.g. 'Football Tournament', 'Study Session') or null",
  "date_str": "Relative or absolute date phrase (e.g. 'today', 'tomorrow', 'next Monday', '2026-10-31') or null",
  "time_str": "Time phrase (e.g. '6:00 PM', '18:00', '10:30 am') or null",
  "schedule_times": ["HH:MM", ...] or null,
  "clarification_needed": true | false,
  "clarification_question": "Concise follow-up question if required info (like what or when) is missing, else null",
  "conversational_reply": "Friendly, professional assistant response text"
}
Output ONLY valid JSON.
"""


def extract_schedule_regex(message_text: str) -> Optional[Dict[str, Any]]:
    """Deterministic regex extractor for scheduling events, tournaments, meetings, and times."""
    time_match = re.search(r'\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b', message_text, re.IGNORECASE)
    date_match = re.search(r'\b(today|tonight|tomorrow|day after tomorrow|next\s+[a-z]+)\b', message_text, re.IGNORECASE)
    
    event_keywords = [
        "tournament", "match", "meeting", "meet", "appointment", "class", 
        "practice", "workout", "gym", "exam", "quiz", "interview", 
        "session", "call", "dinner", "lunch", "football", "cricket", "basketball",
        "schedule", "shedule", "skedule", "book", "study"
    ]
    has_event = any(w in message_text.lower() for w in event_keywords)

    if not (time_match or has_event):
        return None

    date_str = date_match.group(1).lower() if date_match else None
    time_str = time_match.group(1) if time_match else None
    if time_str and not any(x in time_str.lower() for x in ["am", "pm"]) and ":" not in time_str:
        try:
            val = int(time_str.strip())
            if 1 <= val <= 11:
                time_str = f"{val}:00 pm" if val >= 5 else f"{val}:00 am"
        except Exception:
            pass

    title = message_text
    title = re.sub(r'^(i have (a |an )?|s[ck]h?edule (my |a |an )?|book (my |a |an )?|remind me to |set up (a )?)', '', title, flags=re.IGNORECASE)
    if time_match:
        title = title.replace(time_match.group(0), '')
    if date_match:
        title = title.replace(date_match.group(0), '')
    title = re.sub(r'^(time|task|event|slot)\s+(for|to|of)?\s*', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\b(at|on|for|of)\b', '', title, flags=re.IGNORECASE).strip()
    title = re.sub(r'\s+', ' ', title).strip()
    if title.lower() == "study":
        title = "Study Session"
    title = title.title() if title else "Scheduled Event"
    
    return {"title": title, "date_str": date_str, "time_str": time_str}




def _resolve_datetime(date_str: Optional[str], time_str: Optional[str], user_tz: ZoneInfo) -> Optional[datetime]:
    """Deterministically resolves date and time strings into a UTC datetime object."""
    now_local = datetime.now(user_tz)
    target_date = now_local.date()
    explicit_date = bool(date_str)

    if date_str:
        clean_date = date_str.lower().strip()
        if clean_date in ("today", "tonight"):
            target_date = now_local.date()
        elif clean_date == "tomorrow":
            target_date = now_local.date() + timedelta(days=1)
        elif clean_date == "day after tomorrow":
            target_date = now_local.date() + timedelta(days=2)
        else:
            try:
                parsed = dateutil_parser.parse(date_str, default=now_local)
                target_date = parsed.date()
            except Exception:
                target_date = now_local.date()

    target_hour = 12
    target_minute = 0

    if time_str:
        clean_time = time_str.strip()
        # Regex check for common formats like "6 pm", "6:30pm", "18:00"
        match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', clean_time, re.IGNORECASE)
        if match:
            h = int(match.group(1))
            m = int(match.group(2)) if match.group(2) else 0
            meridiem = (match.group(3) or "").lower()
            if meridiem == "pm" and h < 12:
                h += 12
            elif meridiem == "am" and h == 12:
                h = 0
            target_hour = h
            target_minute = m
        else:
            try:
                parsed_time = dateutil_parser.parse(time_str, default=now_local)
                target_hour = parsed_time.hour
                target_minute = parsed_time.minute
            except Exception:
                pass

    try:
        combined_local = datetime(
            target_date.year, target_date.month, target_date.day,
            target_hour, target_minute, 0, tzinfo=user_tz
        )
        # If the user did not explicitly specify a date (or said 'today' without realizing it passed),
        # but the time has already passed today, assume they meant tomorrow.
        if combined_local < (now_local - timedelta(minutes=2)):
            if not explicit_date or (date_str and date_str.lower().strip() == "today"):
                combined_local += timedelta(days=1)

        return combined_local.astimezone(timezone.utc)
    except Exception as e:
        logger.warning(f"Failed to resolve datetime: {e}")
        return None


async def process_message(
    user: models.User,
    message_text: str,
    db: AsyncSession,
    created_via: str = "web",
    history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Main entry point for processing personal assistant messages from web or Telegram.
    Returns:
      {
        "reply": str,
        "action": str,
        "task": Optional[dict],
        "undo_token": Optional[str]
      }
    """
    if not message_text or not message_text.strip():
        return {"reply": "How can I assist you with your schedule today?", "action": "general_chat"}

    if not _check_rate_limit(str(user.id)):
        return {
            "reply": "⚠️ Assistant rate limit reached. Please wait a few moments before sending more requests.",
            "action": "rate_limited"
        }

    user_tz = get_user_zone(user)
    now_local = datetime.now(user_tz)
    now_utc = datetime.now(timezone.utc)

    # 1. Classify & extract intent with Groq
    history_context = ""
    if history:
        last_msgs = [f"{m.get('role', 'user').capitalize()}: {m.get('content', '')}" for m in history[-4:]]
        history_context = "Recent Conversation:\n" + "\n".join(last_msgs) + "\n\n"

    llm_user_prompt = (
        f"Current User Local Time: {now_local.strftime('%A, %Y-%m-%d %H:%M')} ({user_tz.key})\n"
        f"{history_context}"
        f"Latest User Message: \"{message_text.strip()}\""
    )
    try:
        raw_resp = await call_groq(SYSTEM_PROMPT, llm_user_prompt, model=GROQ_MODEL_FAST, temperature=0.1)
        cleaned_json = raw_resp.strip()
        if cleaned_json.startswith("```"):
            cleaned_json = re.sub(r"^```(?:json)?\n?", "", cleaned_json)
            cleaned_json = re.sub(r"\n?```$", "", cleaned_json)
        extracted = json.loads(cleaned_json)
    except Exception as e:
        logger.warning(f"Personal agent classification fallback on error: {e}")
        # Smart regex heuristics fallback
        reg_sched = extract_schedule_regex(message_text)
        lower_msg = message_text.lower()
        if reg_sched and reg_sched.get("time_str"):
            extracted = {
                "action": "schedule_task",
                "title": reg_sched["title"],
                "date_str": reg_sched["date_str"],
                "time_str": reg_sched["time_str"],
                "clarification_needed": False
            }
        elif any(w in lower_msg for w in ["schedule my", "schedule a", "remind me to", "book my", "book a"]):
            extracted = {"action": "schedule_task", "title": message_text, "date_str": "today", "time_str": None, "clarification_needed": False}
        elif any(w in lower_msg for w in ["schedule", "agenda", "tasks today", "what's my day"]):
            extracted = {"action": "get_daily_schedule", "clarification_needed": False}
        elif any(w in lower_msg for w in ["streak", "missed", "overdue", "passed", "completed goals"]):
            extracted = {"action": "get_accountability_status", "clarification_needed": False}
        else:
            extracted = {"action": "general_chat", "conversational_reply": "I am here to help manage your schedule and study milestones. What would you like to plan?"}

    action = extracted.get("action", "general_chat")

    # 2. Check for ambiguity / clarification needed
    if extracted.get("clarification_needed") and extracted.get("clarification_question"):
        return {
            "reply": extracted["clarification_question"],
            "action": "clarification",
            "task": None
        }

    # ── Action: Schedule Task ──────────────────────────────────────────────
    if action == "schedule_task":
        title = (extracted.get("title") or message_text).strip()
        # Clean title prefix
        title = re.sub(r'^(schedule|set up|create|add|remind me to)\s+(my|a|an)?\s*', '', title, flags=re.IGNORECASE).strip()
        title = title[:120] if title else "Meeting"

        date_str = extracted.get("date_str") or "today"
        time_str = extracted.get("time_str")

        target_utc = _resolve_datetime(date_str, time_str, user_tz)
        if not target_utc:
            return {
                "reply": "I couldn't quite resolve the time for that task. Could you specify the time, for example: *'schedule meet at 6 pm'*?",
                "action": "clarification"
            }

        # Check: Not in the past (allow 2 min buffer)
        if target_utc < (now_utc - timedelta(minutes=2)):
            return {
                "reply": "⚠️ That time has already passed today. Please pick a future time.",
                "action": "rejected_past"
            }

        # Check: Not beyond 1 year
        if target_utc > (now_utc + timedelta(days=365)):
            return {
                "reply": "⚠️ I can only schedule tasks up to 1 year ahead.",
                "action": "rejected_far_future"
            }

        # Deduplication check: same title ± 15 min window
        window_start = target_utc - timedelta(minutes=15)
        window_end = target_utc + timedelta(minutes=15)
        existing = await db.execute(
            select(models.PersonalTask).where(
                models.PersonalTask.user_id == user.id,
                models.PersonalTask.status.in_(["active", "pending"]),
                models.PersonalTask.scheduled_at >= window_start,
                models.PersonalTask.scheduled_at <= window_end,
                models.PersonalTask.title.ilike(f"%{title}%")
            )
        )
        duplicate = existing.scalar_one_or_none()
        if inspect.isawaitable(duplicate):
            duplicate = await duplicate
        if duplicate:
            dup_local = duplicate.scheduled_at.astimezone(user_tz)
            return {
                "reply": f"📌 You already have **'{duplicate.title}'** scheduled around that time ({dup_local.strftime('%I:%M %p')}). Did you want to keep or reschedule it?",
                "action": "duplicate_found",
                "task": {"id": str(duplicate.id), "title": duplicate.title}
            }

        # Save PersonalTask
        new_task = models.PersonalTask(
            user_id=user.id,
            title=title,
            description=f"Scheduled via {created_via} assistant",
            scheduled_at=target_utc,
            status="active",
            created_via=created_via
        )
        db.add(new_task)
        await db.commit()
        await db.refresh(new_task)

        target_local = target_utc.astimezone(user_tz)
        local_time_display = target_local.strftime("%A, %b %d at %I:%M %p")
        reply = (
            f"✅ **Scheduled:** **{title}**\n"
            f"📅 {local_time_display} ({user_tz.key})\n\n"
            f"I have recorded this in your [Calendar](/calendar) and will notify you when it's time."
        )

        return {
            "reply": reply,
            "action": "schedule_task",
            "task": {
                "id": str(new_task.id),
                "title": new_task.title,
                "scheduled_at": target_utc.isoformat(),
                "scheduled_local": local_time_display
            },
            "undo_token": str(new_task.id)
        }

    # ── Action: Cancel Task ────────────────────────────────────────────────
    if action == "cancel_task":
        query_title = (extracted.get("title") or message_text).strip()
        query_title = re.sub(r'^(cancel|delete|remove)\s+(my|the)?\s*', '', query_title, flags=re.IGNORECASE).strip()

        # Find active task matching title
        stmt = (
            select(models.PersonalTask)
            .where(
                models.PersonalTask.user_id == user.id,
                models.PersonalTask.status.in_(["active", "pending"])
            )
            .order_by(models.PersonalTask.scheduled_at.desc())
        )
        res = await db.execute(stmt)
        active_tasks = res.scalars().all()

        matched_task = None
        for t in active_tasks:
            if query_title.lower() in t.title.lower() or t.title.lower() in query_title.lower():
                matched_task = t
                break

        if matched_task:
            matched_task.status = "cancelled"
            await db.commit()
            return {
                "reply": f"🗑️ Cancelled: **{matched_task.title}** has been removed from your calendar.",
                "action": "cancel_task",
                "task": {"id": str(matched_task.id), "title": matched_task.title}
            }
        else:
            return {
                "reply": f"I couldn't find an active task matching \"{query_title}\". Check your [Calendar](/calendar) for current events.",
                "action": "cancel_task"
            }

    # ── Action: Adjust Study Schedule ──────────────────────────────────────
    if action == "adjust_study_schedule":
        times = extracted.get("schedule_times")
        if not times and extracted.get("time_str"):
            # Parse time string e.g. "8pm" -> "20:00"
            m = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', extracted["time_str"], re.IGNORECASE)
            if m:
                h = int(m.group(1))
                minute = int(m.group(2)) if m.group(2) else 0
                mer = (m.group(3) or "").lower()
                if mer == "pm" and h < 12:
                    h += 12
                elif mer == "am" and h == 12:
                    h = 0
                times = [f"{h:02d}:{minute:02d}"]

        if times and isinstance(times, list):
            valid_times = []
            for t in times:
                if re.match(r'^\d{2}:\d{2}$', str(t).strip()):
                    valid_times.append(str(t).strip())
            if valid_times:
                user.study_schedule = sorted(list(set(valid_times)))
                db.add(user)
                await db.commit()
                display_slots = ", ".join(user.study_schedule)
                return {
                    "reply": f"⏰ **Study Schedule Updated:** Your daily study nudge sessions are now set to `{display_slots}` ({user_tz.key}).",
                    "action": "adjust_study_schedule"
                }

        return {
            "reply": "Please specify the new study time (e.g. *'adjust study time to 20:00'* or *'set study slots to 2pm and 8pm'*).",
            "action": "clarification"
        }

    # ── Action: Get Daily Schedule ─────────────────────────────────────────
    if action == "get_daily_schedule":
        start_of_day_local = datetime(now_local.year, now_local.month, now_local.day, 0, 0, 0, tzinfo=user_tz)
        end_of_day_local = start_of_day_local + timedelta(days=1)
        start_utc = start_of_day_local.astimezone(timezone.utc)
        end_utc = end_of_day_local.astimezone(timezone.utc)

        # 1. Fetch personal tasks for today (PersonalTask has scheduled_at)
        p_res = await db.execute(
            select(models.PersonalTask).where(
                models.PersonalTask.user_id == user.id,
                models.PersonalTask.status.in_(["active", "pending"]),
                models.PersonalTask.scheduled_at >= start_utc,
                models.PersonalTask.scheduled_at < end_utc
            ).order_by(models.PersonalTask.scheduled_at.asc())
        )
        today_personal = p_res.scalars().all()

        # 2. Fetch currently active roadmap tasks (Task has no scheduled_at, use status="active")
        r_res = await db.execute(
            select(models.Task, models.Goal.title.label("goal_title"))
            .join(models.Goal, models.Task.goal_id == models.Goal.id)
            .where(
                models.Goal.user_id == user.id,
                models.Goal.status == "active",
                models.Task.status == "active",
            )
            .order_by(models.Task.order_index.asc())
        )
        active_roadmap = r_res.all()

        lines = [f"📅 **Your Daily Agenda for Today ({now_local.strftime('%A, %b %d')}):**\n"]

        # Study sessions
        study_slots = user.study_schedule or ["12:00", "18:00"]
        lines.append(f"⏰ **Study Nudge Slots:** `{', '.join(study_slots)}` ({user_tz.key})\n")

        if active_roadmap:
            lines.append("🎯 **Active Roadmap Tasks (Today's Focus):**")
            for task_row in active_roadmap:
                t = task_row[0]
                lines.append(f"  • ⏳ **{t.title}** ({task_row.goal_title})")
            lines.append("")
        else:
            lines.append("🎯 **Roadmap Tasks:** No active module right now — check your goals page.\n")

        if today_personal:
            lines.append("📌 **Personal Events & Meetings:**")
            for pt in today_personal:
                pt_time = pt.scheduled_at.astimezone(user_tz).strftime("%I:%M %p")
                lines.append(f"  • 🕒 `{pt_time}` — **{pt.title}**")
            lines.append("")
        else:
            lines.append("📌 **Personal Events:** None scheduled for today.\n")

        lines.append(f"🔥 **Current Streak:** {user.current_streak} days")
        return {"reply": "\n".join(lines), "action": "get_daily_schedule"}

    # ── Action: Get Accountability Status ──────────────────────────────────
    if action == "get_accountability_status":
        # Find tasks that are locked/active but not yet passed across active goals
        overdue_res = await db.execute(
            select(models.Task, models.Goal.title.label("goal_title"))
            .join(models.Goal, models.Task.goal_id == models.Goal.id)
            .where(
                models.Goal.user_id == user.id,
                models.Goal.status == "active",
                models.Task.status.in_(["locked", "active"]),
            )
        )
        pending_tasks = overdue_res.all()

        streak_text = f"🔥 Current Streak: **{user.current_streak} days**"
        if pending_tasks:
            count = len(pending_tasks)
            goals_affected = set(r.goal_title for r in pending_tasks)
            reply = (
                f"⚠️ **Accountability Audit:** You have **{count} incomplete task(s)** across: {', '.join(goals_affected)}.\n\n"
                f"{streak_text}\n\n"
                f"Don't let your streak slip! Jump into the [Study Workbench](/study) and knock out a topic today."
            )
        else:
            reply = (
                f"🌟 **All Clear!** You have passed all tasks in your active goals.\n\n"
                f"{streak_text}\n\n"
                f"Keep up the great momentum!"
            )
        return {"reply": reply, "action": "get_accountability_status"}

    # Default / General Chat
    conversational = extracted.get("conversational_reply") or "I am your personal executive assistant. I can schedule your meetings, manage study times, or give you a briefing on today's agenda."
    return {"reply": conversational, "action": "general_chat"}
