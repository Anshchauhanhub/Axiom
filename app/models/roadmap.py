"""
ORM model — Roadmap.

Stores the raw syllabus and AI-generated JSON plan for a user.
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Roadmap(Base):
    __tablename__ = "roadmaps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    raw_syllabus: Mapped[str] = mapped_column(Text, nullable=False)
    json_plan: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # ── Relationships ───────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="roadmaps")  # noqa: F821
    tasks: Mapped[list["Task"]] = relationship(  # noqa: F821
        "Task", back_populates="roadmap", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Roadmap id={self.id} user_id={self.user_id}>"
