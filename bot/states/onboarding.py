"""
FSM States — Onboarding.

Defines the finite-state-machine states for the user interview flow.
"""

from aiogram.fsm.state import State, StatesGroup


class OnboardingStates(StatesGroup):
    """The 4-step interrogation."""
    waiting_for_goal = State()
    waiting_for_days = State()
    waiting_for_syllabus = State()
    waiting_for_schedule = State()
