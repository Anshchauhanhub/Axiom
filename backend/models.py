import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, BigInteger, Boolean, ForeignKey, Text, DateTime, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)
    account_type = Column(String, nullable=False, default="student")  # student, creator
    password_hash = Column(String, nullable=False)
    telegram_chat_id = Column(BigInteger, unique=True, nullable=True)
    timezone = Column(String, default="Asia/Kolkata")
    study_schedule = Column(JSONB, default=lambda: ["12:00", "18:00"])
    current_streak = Column(Integer, default=0)
    credits = Column(Integer, default=5, nullable=False) # Ad-supported monetization
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    goals = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    quiz_results = relationship("QuizResult", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    personal_tasks = relationship("PersonalTask", back_populates="user", cascade="all, delete-orphan")


class PersonalTask(Base):
    __tablename__ = "personal_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True) # User's reasoning or notes
    status = Column(String, default="pending") # pending, completed
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="personal_tasks")


class RoadmapTemplate(Base):
    """Canonical, reusable roadmap templates — the expensive LLM output, cached."""
    __tablename__ = "roadmap_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_hash = Column(String, unique=True, nullable=False, index=True)  # SHA256 of normalized goal
    goal_text = Column(Text, nullable=False)  # Original phrasing, for reference
    pinecone_vector_id = Column(String, nullable=True)  # Pointer into Pinecone index
    syllabus_json = Column(JSONB, nullable=False)  # The Task -> Part hierarchy
    hit_count = Column(Integer, default=1)  # Track reuse for analytics
    detected_entity = Column(String, nullable=True)  # e.g. "GATE DA", "CAT" — for entity-linked syllabi
    verification_passed = Column(Boolean, default=True)  # False if draft failed Jaccard check
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Entity syllabi expire faster (90d vs 365d)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    goals = relationship("Goal", back_populates="template")


class Goal(Base):
    __tablename__ = "goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("roadmap_templates.id"), nullable=True)  # Link to cached template
    title = Column(String, nullable=False)
    status = Column(String, default="active")  # active, completed, paused
    cache_hit = Column(Boolean, default=False)  # For cost tracking / analytics
    notes = Column(JSONB, nullable=True) # Block-based multimedia notes
    settings = Column(JSONB, default=dict) # Goal-specific configurations

    user = relationship("User", back_populates="goals")
    template = relationship("RoadmapTemplate", back_populates="goals")
    tasks = relationship("Task", back_populates="goal", cascade="all, delete-orphan")





class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    order_index = Column(Integer, nullable=False)
    status = Column(String, default="locked")  # locked, active, passed

    goal = relationship("Goal", back_populates="tasks")
    parts = relationship("Part", back_populates="task", cascade="all, delete-orphan")


class Part(Base):
    __tablename__ = "parts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    status = Column(String, default="locked")  # locked, active, passed
    content = Column(Text, nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)

    task = relationship("Task", back_populates="parts")
    quiz_results = relationship("QuizResult", back_populates="part", cascade="all, delete-orphan")




class QuizResult(Base):
    __tablename__ = "quiz_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    part_id = Column(UUID(as_uuid=True), ForeignKey("parts.id", ondelete="CASCADE"), nullable=False, index=True)
    score_percent = Column(Float, nullable=False)
    is_passed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="quiz_results")
    part = relationship("Part", back_populates="quiz_results")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=True) # Nullable for legacy messages
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="chat_messages")
    session = relationship("ChatSession", back_populates="messages")
