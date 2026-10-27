"""
CheckpointStore — Resumable stage checkpointing for the goal agent pipeline.

Backends (auto-selected):
  - Redis  (if REDIS_URL env var is set) — TTL = 1 hour, cross-worker safe
  - In-memory dict (default dev fallback) — same-process only, no TTL

Usage:
    store = get_checkpoint_store()
    await store.save("run_abc", "research", state_dict)
    partial = await store.load("run_abc")
    # partial is {"stage": "research", "state": {...}} or None
    await store.clear("run_abc")
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any, Optional

logger = logging.getLogger("edxiom.checkpoint")

_TTL_SECONDS = int(os.getenv("CHECKPOINT_TTL_S", "3600"))  # 1 hour default


# ── In-memory backend ─────────────────────────────────────────────────

class _MemoryStore:
    """Thread-safe (asyncio) in-memory checkpoint store with TTL eviction."""

    def __init__(self, ttl_s: int = _TTL_SECONDS):
        self._data: dict[str, dict] = {}  # run_id -> {stage, state, ts}
        self._ttl = ttl_s
        self._lock = asyncio.Lock()

    async def save(self, run_id: str, stage: str, state: dict) -> None:
        async with self._lock:
            self._data[run_id] = {
                "stage": stage,
                "state": state,
                "ts": time.time(),
            }
            logger.debug(f"[checkpoint:mem] saved run={run_id} stage={stage}")

    async def load(self, run_id: str) -> Optional[dict]:
        async with self._lock:
            entry = self._data.get(run_id)
            if not entry:
                return None
            if time.time() - entry["ts"] > self._ttl:
                del self._data[run_id]
                return None
            return {"stage": entry["stage"], "state": entry["state"]}

    async def clear(self, run_id: str) -> None:
        async with self._lock:
            self._data.pop(run_id, None)


# ── Redis backend ─────────────────────────────────────────────────────

class _RedisStore:
    """Redis-backed checkpoint store. Requires `redis` package and REDIS_URL env var."""

    def __init__(self, redis_url: str, ttl_s: int = _TTL_SECONDS):
        import redis.asyncio as aioredis
        self._r = aioredis.from_url(redis_url, decode_responses=True)
        self._ttl = ttl_s

    def _key(self, run_id: str) -> str:
        return f"edxiom:checkpoint:{run_id}"

    async def save(self, run_id: str, stage: str, state: dict) -> None:
        payload = json.dumps({"stage": stage, "state": state})
        await self._r.set(self._key(run_id), payload, ex=self._ttl)
        logger.debug(f"[checkpoint:redis] saved run={run_id} stage={stage}")

    async def load(self, run_id: str) -> Optional[dict]:
        raw = await self._r.get(self._key(run_id))
        if not raw:
            return None
        return json.loads(raw)

    async def clear(self, run_id: str) -> None:
        await self._r.delete(self._key(run_id))


# ── Public CheckpointStore facade ────────────────────────────────────

class CheckpointStore:
    """
    Facade that delegates to Redis or in-memory backend depending on REDIS_URL.
    """

    def __init__(self):
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                self._backend = _RedisStore(redis_url)
                logger.info(f"[checkpoint] Using Redis backend: {redis_url[:30]}...")
            except ImportError:
                logger.warning("[checkpoint] redis package not installed — falling back to memory")
                self._backend = _MemoryStore()
        else:
            self._backend = _MemoryStore()
            logger.debug("[checkpoint] Using in-memory backend (no REDIS_URL)")

    async def save(self, run_id: str, stage: str, state: Any) -> None:
        """Persist state after completing a pipeline stage."""
        try:
            # state must be JSON-serialisable; strip non-serialisable fields gracefully
            serialisable = _make_serialisable(state)
            await self._backend.save(run_id, stage, serialisable)
        except Exception as e:
            logger.warning(f"[checkpoint] save failed for run={run_id} stage={stage}: {e}")

    async def load(self, run_id: str) -> Optional[dict]:
        """Load last checkpoint for a run_id. Returns None if not found or expired."""
        try:
            return await self._backend.load(run_id)
        except Exception as e:
            logger.warning(f"[checkpoint] load failed for run={run_id}: {e}")
            return None

    async def clear(self, run_id: str) -> None:
        """Delete checkpoint after successful pipeline completion."""
        try:
            await self._backend.clear(run_id)
        except Exception as e:
            logger.warning(f"[checkpoint] clear failed for run={run_id}: {e}")


def _make_serialisable(obj: Any) -> Any:
    """Recursively convert non-JSON-serialisable values to strings."""
    if isinstance(obj, dict):
        return {k: _make_serialisable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_make_serialisable(v) for v in obj]
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return str(obj)


# ── Module-level singleton ────────────────────────────────────────────

_store: Optional[CheckpointStore] = None


def get_checkpoint_store() -> CheckpointStore:
    """Return the module-level CheckpointStore singleton."""
    global _store
    if _store is None:
        _store = CheckpointStore()
    return _store
