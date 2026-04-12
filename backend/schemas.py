import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


# --- Auth ---
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    timezone: str = "Asia/Kolkata"
    study_schedule: list[str] = ["12:00", "18:00"]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LinkTelegramRequest(BaseModel):
    telegram_chat_id: int


# --- User ---
class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    telegram_chat_id: Optional[int] = None
    timezone: str
    study_schedule: list[str]
    current_streak: int

    class Config:
        from_attributes = True


class UpdateScheduleRequest(BaseModel):
    timezone: str
    study_schedule: list[str]


# --- Goals ---
class CreateGoalRequest(BaseModel):
    title: str


class GoalResponse(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class UpdateNotesRequest(BaseModel):
    notes: str


# --- Tasks & Parts ---
class PartResponse(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    content: Optional[str] = None

    class Config:
        from_attributes = True


class PartContentResponse(BaseModel):
    part_id: uuid.UUID
    title: str
    content: str


class TaskResponse(BaseModel):
    id: uuid.UUID
    title: str
    order_index: int
    status: str
    parts: list[PartResponse] = []

    class Config:
        from_attributes = True


class RoadmapResponse(BaseModel):
    goal: GoalResponse
    tasks: list[TaskResponse]


# --- Quiz ---
class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int


class StartQuizResponse(BaseModel):
    quiz_token: str
    part_title: str
    questions: list[dict]  # Options only, no correct_index sent to client


class SubmitAnswerRequest(BaseModel):
    quiz_token: str
    answers: list[int]  # List of selected option indices


class QuizResultResponse(BaseModel):
    score_percent: float
    is_passed: bool
    message: str


class QuizExpiredResponse(BaseModel):
    expired: bool = True
    message: str = "Session expired. Generating new questions for your restart."


# --- Conversational Onboarding ---
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class OnboardingChatRequest(BaseModel):
    messages: list[ChatMessage]


class OnboardingChatResponse(BaseModel):
    message: str
    draft_roadmap: Optional[list[dict]] = None
    phase: str  # "discovery", "syllabus", "draft", "refinement", "ready"


class FinalizeGoalRequest(BaseModel):
    title: str
    roadmap: list[dict]
