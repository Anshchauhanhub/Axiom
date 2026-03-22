"""
Utility helpers used across the Axiom application.
"""

from datetime import datetime, timezone


def utc_now() -> datetime:
    """Return the current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


def truncate(text: str, max_len: int = 200) -> str:
    """Truncate text to a maximum length, appending '…' if trimmed."""
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"
