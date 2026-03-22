"""
app.models package.

Import all models here so SQLAlchemy resolves all relationship()
string references (e.g. 'Roadmap' inside User) correctly.
"""

from app.models.user import User  # noqa: F401
from app.models.roadmap import Roadmap  # noqa: F401
from app.models.task import Task  # noqa: F401
from app.models.verification import Verification  # noqa: F401
