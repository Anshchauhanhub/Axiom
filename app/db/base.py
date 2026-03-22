"""
Axiom — SQLAlchemy Declarative Base.

Import ``Base`` in every model file.
Model registration for Alembic is handled in ``alembic/env.py``.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass
