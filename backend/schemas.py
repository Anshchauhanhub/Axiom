import re
import uuid
from datetime import datetime
from typing import Optional, Union
from pydantic import BaseModel, EmailStr, field_validator


# --- Auth ---
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    timezone: str = "Asia/Kolkata"
    study_schedule: list[str] = ["12:00", "18:00"]

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v


class GoogleLoginRequest(BaseModel):
    credential: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LinkTelegramRequest(BaseModel):
    telegram_chat_id: int


# --- User ---
class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: Optional[str] = None
    profile_image_url: Optional[str] = None
    telegram_chat_id: Optional[int] = None
    timezone: str
    study_schedule: list[str]
    current_streak: int

    class Config:
        from_attributes = True


class UpdateScheduleRequest(BaseModel):
    timezone: str
    study_schedule: list[str]


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None


# --- Goals ---
class CreateGoalRequest(BaseModel):
    title: str


class GoalResponse(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    notes: Optional[Union[list, dict, str]] = None

    class Config:
        from_attributes = True


class UpdateNotesRequest(BaseModel):
    notes: Optional[Union[list, dict, str]] = None


# --- Tasks & Parts ---
class PartResponse(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    content: Optional[Union[list, str]] = None

    class Config:
        from_attributes = True


class PartContentResponse(BaseModel):
    part_id: uuid.UUID
    title: str
    content: Union[list, str]


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

class CalendarTaskResponse(BaseModel):
    id: str
    title: str
    status: str
    task_title: str
    goal_title: str
    goal_id: str
    completed_at: Optional[datetime] = None


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


class ChatSessionResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OnboardingChatRequest(BaseModel):
    messages: list[ChatMessage]
    session_id: Optional[str] = None


class OnboardingChatResponse(BaseModel):
    message: str
    draft_roadmap: Optional[list[dict]] = None
    phase: str  # "discovery", "syllabus", "draft", "refinement", "ready"
    session_id: Optional[str] = None


class FinalizeGoalRequest(BaseModel):
    title: str
    roadmap: list[dict]


class YoutubeRoadmapRequest(BaseModel):
    url: str


class YoutubeRoadmapResponse(BaseModel):
    draft_roadmap: list[dict]
    goal_title: str


# --- Social ---
class PostCreateRequest(BaseModel):
    goal_id: Optional[uuid.UUID] = None
    content: Union[list, dict, str]
    post_type: str = "lesson"


class PostResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    goal_id: Optional[uuid.UUID] = None
    content: Union[list, dict, str]
    post_type: str
    created_at: datetime
    user_email: Optional[str] = None
    user_full_name: Optional[str] = None
    user_profile_image: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    is_liked_by_me: bool = False

    class Config:
        from_attributes = True


class CommentCreateRequest(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: uuid.UUID
    post_id: uuid.UUID
    user_id: uuid.UUID
    content: str
    created_at: datetime
    user_full_name: Optional[str] = None
    user_profile_image: Optional[str] = None

    class Config:
        from_attributes = True
