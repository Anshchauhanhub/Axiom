"""
Handler — Onboarding (The Interrogation).

FSM-driven conversational flow:
  State 1: Ask goal
  State 2: Ask total days
  State 3: Ask syllabus (text or PDF)
  State 4: Ask daily routine → extract study_schedule
  Final: Generate goal + roadmap
"""

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from bot.states.onboarding import OnboardingStates

router = Router()


@router.message(Command("onboard"))
async def start_onboarding(message: Message, state: FSMContext) -> None:
    """Phase A — Step 1: Ask for the learning goal."""
    await state.set_state(OnboardingStates.waiting_for_goal)
    await message.answer(
        "🎯 <b>Step 1/4 — What's your learning goal?</b>\n\n"
        "Example: <i>\"Crack GATE DA Exam\"</i>"
    )


@router.message(OnboardingStates.waiting_for_goal)
async def receive_goal(message: Message, state: FSMContext) -> None:
    """Receive the goal and advance to total days."""
    await state.update_data(goal=message.text)
    await state.set_state(OnboardingStates.waiting_for_days)
    await message.answer(
        "📅 <b>Step 2/4 — How many days do you want to achieve this in?</b>\n\n"
        "Just send a number (e.g. <i>60</i> or <i>90</i>)."
    )


@router.message(OnboardingStates.waiting_for_days, F.text.regexp(r"^\d+$"))
async def receive_days(message: Message, state: FSMContext) -> None:
    """Receive total days and advance to syllabus."""
    days = int(message.text)
    if days < 1 or days > 365:
        await message.answer("Please enter a realistic number (1–365).")
        return

    await state.update_data(total_days=days)
    await state.set_state(OnboardingStates.waiting_for_syllabus)
    await message.answer(
        "📚 <b>Step 3/4 — Paste your syllabus or topic list.</b>\n\n"
        "You can send it as plain text or bullet points.\n"
        "<i>PDF upload support coming soon!</i>"
    )


@router.message(OnboardingStates.waiting_for_syllabus)
async def receive_syllabus(message: Message, state: FSMContext) -> None:
    """Receive syllabus and ask for daily routine."""
    await state.update_data(syllabus=message.text)
    await state.set_state(OnboardingStates.waiting_for_schedule)
    await message.answer(
        "⏰ <b>Step 4/4 — What's your daily study routine?</b>\n\n"
        "Tell me when you can study. Example:\n"
        "<i>\"I can study at 9 AM and 8 PM daily\"</i>\n\n"
        "Or just send the times like: <i>09:00, 20:00</i>"
    )


@router.message(OnboardingStates.waiting_for_schedule)
async def receive_schedule(message: Message, state: FSMContext) -> None:
    """Receive daily schedule and trigger goal generation."""
    data = await state.get_data()
    goal = data.get("goal")
    total_days = data.get("total_days")
    syllabus = data.get("syllabus")
    schedule_text = message.text

    await state.clear()

    # Extract time slots from user's message
    # Simple parsing: look for HH:MM patterns
    import re
    time_slots = re.findall(r"\d{1,2}:\d{2}", schedule_text)
    if not time_slots:
        # Fallback: try to parse natural language hours
        hour_matches = re.findall(r"(\d{1,2})\s*(am|pm|AM|PM)", schedule_text)
        for h, period in hour_matches:
            hour = int(h)
            if period.lower() == "pm" and hour != 12:
                hour += 12
            elif period.lower() == "am" and hour == 12:
                hour = 0
            time_slots.append(f"{hour:02d}:00")

    if not time_slots:
        time_slots = ["09:00"]  # Default fallback

    await message.answer(
        f"✅ <b>Got it!</b>\n\n"
        f"🎯 Goal: <i>{goal}</i>\n"
        f"📅 Duration: <i>{total_days} days</i>\n"
        f"📚 Syllabus received ({len(syllabus)} chars)\n"
        f"⏰ Study times: <i>{', '.join(time_slots)}</i>\n\n"
        f"⏳ Generating your personalized roadmap with AI… This may take a moment."
    )

    # TODO: Call goal_gen service and send the plan back.
    # TODO: Save study_schedule to user via onboarding.upsert_user_schedule.
