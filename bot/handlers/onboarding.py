"""
Handler — Onboarding (The Interrogation).

FSM-driven conversational flow:
  State 1: Ask goal
  State 2: Ask hours/day
  State 3: Ask syllabus (text or PDF)
  State 4: Generate roadmap
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
        "🎯 <b>Step 1/3 — What's your learning goal?</b>\n\n"
        "Example: <i>\"Master Data Structures & Algorithms in Python\"</i>"
    )


@router.message(OnboardingStates.waiting_for_goal)
async def receive_goal(message: Message, state: FSMContext) -> None:
    """Receive the goal and advance to hours."""
    await state.update_data(goal=message.text)
    await state.set_state(OnboardingStates.waiting_for_hours)
    await message.answer(
        "⏰ <b>Step 2/3 — How many hours per day can you dedicate?</b>\n\n"
        "Just send a number (e.g. <i>2</i>)."
    )


@router.message(OnboardingStates.waiting_for_hours, F.text.regexp(r"^\d+$"))
async def receive_hours(message: Message, state: FSMContext) -> None:
    """Receive hours and advance to syllabus."""
    hours = int(message.text)
    if hours < 1 or hours > 16:
        await message.answer("Please enter a realistic number (1–16).")
        return

    await state.update_data(hours=hours)
    await state.set_state(OnboardingStates.waiting_for_syllabus)
    await message.answer(
        "📚 <b>Step 3/3 — Paste your syllabus or topic list.</b>\n\n"
        "You can send it as plain text or bullet points.\n"
        "<i>PDF upload support coming soon!</i>"
    )


@router.message(OnboardingStates.waiting_for_syllabus)
async def receive_syllabus(message: Message, state: FSMContext) -> None:
    """Receive syllabus and trigger roadmap generation."""
    data = await state.get_data()
    goal = data.get("goal")
    hours = data.get("hours")
    syllabus = message.text

    await state.clear()

    await message.answer(
        f"✅ <b>Got it!</b>\n\n"
        f"🎯 Goal: <i>{goal}</i>\n"
        f"⏰ Hours/day: <i>{hours}</i>\n"
        f"📚 Syllabus received ({len(syllabus)} chars)\n\n"
        f"⏳ Generating your roadmap with AI… This may take a moment."
    )

    # TODO: Call roadmap generation service and send the plan back.
