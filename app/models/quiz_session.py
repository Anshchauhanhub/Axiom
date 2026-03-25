"""
ORM model — QuizSession.

Replacement for Redis sessions. Stores active quiz data in PostgreSQL.
"""

import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

class QuizSession(Base):
    __tablename__ = "quiz_sessions"

    # We use a UUID id, but we also store the session_id (which could be user_id or telegram_chat_id)
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    
    # The identifier used by the frontend/bot (User UUID string or Telegram Chat ID int)
    session_id: Mapped[str] = mapped_column(nullable=False, index=True)
    
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    part_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parts.id", ondelete="CASCADE"), nullable=False
    )
    
    questions: Mapped[list[dict]] = mapped_column(JSONB, nullable=False)
    answers: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User") # noqa: F821
    part: Mapped["Part"] = relationship("Part") # noqa: F821

    def __repr__(self) -> str:
        return f"<QuizSession id={self.id} user_id={self.user_id} part_id={self.part_id}>"
