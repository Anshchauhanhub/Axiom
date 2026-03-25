"""
app.models package.

Import all models here so SQLAlchemy resolves all relationship()
string references (e.g. 'Goal' inside User) correctly.
"""

from app.models.user import User  # noqa: F401
from app.models.goal import Goal  # noqa: F401
from app.models.task import Task  # noqa: F401
from app.models.part import Part  # noqa: F401
from app.models.quiz_result import QuizResult  # noqa: F401
