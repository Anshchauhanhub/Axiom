"""
LLM Output Parsers.

Pydantic models that ENFORCE the JSON structure returned by the LLM.
If the LLM returns invalid data, these will raise a ValidationError
instead of letting garbage reach the database.
"""

from pydantic import BaseModel, field_validator


# ── Roadmap Schema ──────────────────────────────────────
class DayPlan(BaseModel):
    day: int
    title: str
    subtopics: list[str] | str | None = None
    description: str | None = None
    duration_hours: int = 2


class RoadmapPlan(BaseModel):
    title: str
    total_days: int
    days: list[DayPlan]

    @field_validator("days")
    @classmethod
    def days_not_empty(cls, v):
        if not v:
            raise ValueError("Roadmap must contain at least one day.")
        return v


# ── MCQ Schema ──────────────────────────────────────────
class MCQQuestion(BaseModel):
    question: str
    options: list[str]
    correct: int

    @field_validator("options")
    @classmethod
    def four_options(cls, v):
        if len(v) != 4:
            raise ValueError("Each question must have exactly 4 options.")
        return v

    @field_validator("correct")
    @classmethod
    def valid_index(cls, v):
        if v not in range(4):
            raise ValueError("correct must be 0, 1, 2, or 3.")
        return v


class MCQQuiz(BaseModel):
    questions: list[MCQQuestion]

    @field_validator("questions")
    @classmethod
    def five_questions(cls, v):
        if len(v) != 5:
            raise ValueError("Quiz must contain exactly 5 questions.")
        return v


# ── Validation helpers ──────────────────────────────────
def validate_roadmap_json(raw: dict) -> dict:
    """Validate and return a roadmap plan dict."""
    plan = RoadmapPlan(**raw)
    return plan.model_dump()


def validate_mcq_json(raw: dict) -> dict:
    """Validate and return an MCQ quiz dict."""
    quiz = MCQQuiz(**raw)
    return quiz.model_dump()
