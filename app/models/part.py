"""
ORM model — Part.

Daily micro-lessons within a Task (e.g. "Bayes Theorem").
Each part must be passed via quiz to unlock the next.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PartStatus(str, enum.Enum):
    LOCKED = "Locked"
    ACTIVE = "Active"
    PASSED = "Passed"


class Part(Base):
    __tablename__ = "parts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[PartStatus] = mapped_column(
        String(20), default=PartStatus.LOCKED
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # ── Relationships ───────────────────────────────────
    task: Mapped["Task"] = relationship("Task", back_populates="parts")  # noqa: F821
    quiz_results: Mapped[list["QuizResult"]] = relationship(  # noqa: F821
        "QuizResult", back_populates="part", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Part id={self.id} '{self.title}' status={self.status}>"
