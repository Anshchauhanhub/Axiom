"""
Arithmetic Timetable Engine — pure Python scheduling, no LLM calls.

Handles:
- Distributing N parts across user's available days and study sessions
- Personalization of a cached roadmap to a new user's schedule
- Rescheduling from today when a user falls behind
"""

import logging
from datetime import datetime, timedelta, time
from typing import Optional

import pytz

logger = logging.getLogger("edxiom.timetable")


def personalize_pacing(
    syllabus_json: list[dict],
    target_date: Optional[str] = None,
    hours_per_day: Optional[float] = None,
    study_days: Optional[list[int]] = None,
    study_sessions: Optional[list[str]] = None,
    user_timezone: str = "Asia/Kolkata",
    skill_level: Optional[str] = None,
) -> list[dict]:
    """
    Take a cached roadmap template and personalize its pacing for a specific user.

    This is ARITHMETIC, not LLM — it redistributes the same tasks across the
    user's actual available days and hours.

    Args:
        syllabus_json: The cached [{"title": "...", "parts": [...]}] structure.
        target_date: Optional ISO date string for the deadline (e.g. "2026-09-01").
        hours_per_day: How many hours the user can study per day.
        study_days: List of day indices (0=Sun, 1=Mon, ..., 6=Sat). Default Mon-Fri.
        study_sessions: List of time strings like ["09:00", "18:00"]. Default ["18:00"].
        user_timezone: Timezone string.
        skill_level: "beginner", "intermediate", "advanced" — used to optionally
                     compress or expand the schedule.

    Returns:
        The same syllabus structure, unchanged. The scheduling is done separately
        via `generate_schedule_dates()` and applied at the Part persistence layer.
    """
    # The syllabus structure itself doesn't change — it's the same modules and parts.
    # What changes is how they're distributed in time, which is handled by
    # generate_schedule_dates() at insertion time.
    #
    # However, if the user is advanced, we can optionally compress by skipping
    # beginner-level tasks (marked by keywords).

    if skill_level == "advanced" and len(syllabus_json) > 5:
        # Skip the first 1-2 "intro/basics" modules for advanced users
        compressed = []
        for task in syllabus_json:
            title_lower = task.get("title", "").lower()
            if any(kw in title_lower for kw in ["introduction", "basics", "getting started", "what is", "overview"]):
                logger.info(f"⏩ Skipping intro module for advanced user: '{task['title']}'")
                continue
            compressed.append(task)
        # Only apply compression if we still have enough content
        if len(compressed) >= 4:
            return compressed

    return syllabus_json


def generate_schedule_dates(
    num_parts: int,
    study_days: Optional[list[int]] = None,
    study_sessions: Optional[list[str]] = None,
    user_timezone: str = "Asia/Kolkata",
    target_date: Optional[str] = None,
    start_from: Optional[datetime] = None,
) -> list[datetime]:
    """
    Generate a list of scheduled datetime objects for `num_parts` study sessions.

    Pure arithmetic — distributes parts across available time slots.

    Args:
        num_parts: Total number of parts to schedule.
        study_days: Days of the week (0=Sun, 1=Mon, ..., 6=Sat). Default Mon-Fri.
        study_sessions: Time slots like ["09:00", "18:00"]. Default ["18:00"].
        user_timezone: User's timezone string.
        target_date: Optional ISO date deadline. If set, sessions are compressed to fit.
        start_from: Start scheduling from this datetime. Default: now.

    Returns:
        List of timezone-aware datetime objects, one per part.
    """
    if not study_days:
        study_days = [1, 2, 3, 4, 5]  # Mon-Fri
    if not study_sessions:
        study_sessions = ["18:00"]

    try:
        tz = pytz.timezone(user_timezone)
    except Exception:
        tz = pytz.UTC

    now = start_from or datetime.now(tz)
    current_date = now.date()

    # Parse session times and sort
    session_times = sorted([
        datetime.strptime(s, "%H:%M").time() for s in study_sessions
    ])

    # If there's a deadline, calculate max available slots to see if we need
    # to pack more sessions per day
    if target_date:
        try:
            deadline = datetime.strptime(target_date, "%Y-%m-%d").date()
            available_days = sum(
                1 for i in range((deadline - current_date).days + 1)
                if ((current_date + timedelta(days=i)).weekday() + 1) % 7 in study_days
            )
            available_slots = available_days * len(session_times)

            if available_slots < num_parts and available_days > 0:
                # Not enough slots — add more sessions per day
                extra_needed = num_parts - available_slots
                extra_per_day = (extra_needed // available_days) + 1
                # Generate additional evenly-spaced session times
                for i in range(extra_per_day):
                    hour = min(9 + i * 2, 22)  # 9am, 11am, 1pm, etc.
                    new_time = time(hour, 0)
                    if new_time not in session_times:
                        session_times.append(new_time)
                session_times.sort()
                logger.info(f"📅 Compressed schedule: {len(session_times)} sessions/day to meet deadline")
        except (ValueError, TypeError):
            pass  # Invalid date format, ignore deadline

    # Generate the schedule
    schedules = []
    safety_limit = num_parts * 30  # prevent infinite loops
    iterations = 0

    while len(schedules) < num_parts and iterations < safety_limit:
        iterations += 1
        # Convert to frontend day format (0=Sun, 1=Mon, ...)
        frontend_day = (current_date.weekday() + 1) % 7

        if frontend_day in study_days:
            for s_time in session_times:
                try:
                    dt = tz.localize(datetime.combine(current_date, s_time))
                except Exception:
                    dt = datetime.combine(current_date, s_time).replace(tzinfo=tz)

                # Only schedule future times (or if we're past today)
                if dt > now or current_date > now.date():
                    schedules.append(dt)
                    if len(schedules) == num_parts:
                        break

        current_date += timedelta(days=1)

    return schedules


def reschedule_from_today(
    remaining_parts: int,
    study_days: Optional[list[int]] = None,
    study_sessions: Optional[list[str]] = None,
    user_timezone: str = "Asia/Kolkata",
    target_date: Optional[str] = None,
) -> list[datetime]:
    """
    Recalculate the schedule for remaining parts starting from right now.

    Called when a user falls behind or catches up — no LLM call needed,
    just arithmetic redistribution.

    Args:
        remaining_parts: Number of parts still to be scheduled.
        study_days: Available days.
        study_sessions: Available time slots.
        user_timezone: User's timezone.
        target_date: Original deadline (if any).

    Returns:
        New list of scheduled datetimes for the remaining parts.
    """
    return generate_schedule_dates(
        num_parts=remaining_parts,
        study_days=study_days,
        study_sessions=study_sessions,
        user_timezone=user_timezone,
        target_date=target_date,
    )
