"""
Two-Tier Roadmap Cache — exact-hash (Postgres) + semantic (pgvector + MiniLM).

Tier 1: Normalize goal text, SHA256 hash, check `roadmap_templates` table. Free, instant.
Tier 2: Embed with a local MiniLM model, query pgvector in Postgres for cosine similarity >= threshold.

On a miss, the caller should run the full agent pipeline and then call `save_to_cache()`.
"""

import hashlib
import logging
import os
import re
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

load_dotenv()

logger = logging.getLogger("edxiom.cache")

SIMILARITY_THRESHOLD = float(os.getenv("CACHE_SIMILARITY_THRESHOLD", "0.91"))

_embedder = None


def _get_embedder():
    """Lazy-load the SentenceTransformer so cold-start is fast when not needed."""
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedder = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("✅ SentenceTransformer (all-MiniLM-L6-v2) loaded.")
        except ImportError:
            logger.warning("⚠️ sentence-transformers not installed. Semantic cache disabled.")
    return _embedder


# ── Normalization ─────────────────────────────────────────────────────

# Common filler words that don't change the meaning of a learning goal
_FILLER_PATTERN = re.compile(
    r'\b(i want to|i need to|i wanna|help me|please|for|learn|study|master|teach me|'
    r'how to|want to|need to|can you|could you|make me|give me a|create a)\b',
    re.IGNORECASE
)


def normalize_goal(text_val: str) -> str:
    """Normalize a goal string for consistent hashing and comparison."""
    text_val = text_val.lower().strip()
    text_val = _FILLER_PATTERN.sub('', text_val)
    text_val = re.sub(r'[^\w\s]', '', text_val)  # strip punctuation
    text_val = re.sub(r'\s+', ' ', text_val).strip()
    return text_val


def get_goal_hash(text_val: str) -> str:
    """SHA256 hash of the normalized goal text."""
    return hashlib.sha256(normalize_goal(text_val).encode()).hexdigest()


# ── Cache Lookup ──────────────────────────────────────────────────────

async def check_cache(goal_text: str, db: AsyncSession) -> dict:
    """
    Two-tier cache check (Postgres Hash + Postgres pgvector).

    Returns:
        {
            "tier": "exact" | "semantic" | "miss",
            "template": row dict or None,
            "score": float (only for semantic hits)
        }
    """
    goal_hash = get_goal_hash(goal_text)

    # ── Tier 1: Exact match (free, instant) — reject expired entries ──
    result = await db.execute(
        text(
            "SELECT * FROM roadmap_templates WHERE goal_hash = :h "
            "AND (expires_at IS NULL OR expires_at > now()) LIMIT 1"
        ),
        {"h": goal_hash}
    )
    exact = result.mappings().first()
    if exact:
        logger.info(f"🎯 Cache HIT (exact) for: '{goal_text[:60]}...'")
        # Bump hit count
        await db.execute(
            text("UPDATE roadmap_templates SET hit_count = hit_count + 1 WHERE goal_hash = :h"),
            {"h": goal_hash}
        )
        await db.commit()
        return {"tier": "exact", "template": dict(exact), "score": 1.0}

    # ── Tier 2: Semantic match (pgvector in Postgres) ─────────
    embedder = _get_embedder()

    if embedder:
        try:
            vector = embedder.encode(normalize_goal(goal_text)).tolist()
            vector_str = "[" + ",".join(map(str, vector)) + "]"

            query = text(
                "SELECT *, (1 - (embedding <=> CAST(:vec AS vector))) AS similarity_score "
                "FROM roadmap_templates "
                "WHERE embedding IS NOT NULL "
                "AND (expires_at IS NULL OR expires_at > now()) "
                "ORDER BY embedding <=> CAST(:vec AS vector) LIMIT 1"
            )
            sem_result = await db.execute(query, {"vec": vector_str})
            match = sem_result.mappings().first()

            if match and match.get("similarity_score") and float(match["similarity_score"]) >= SIMILARITY_THRESHOLD:
                score = float(match["similarity_score"])
                template_id = str(match["id"])
                logger.info(
                    f"🧠 Cache HIT (pgvector semantic, score={score:.3f}) for: '{goal_text[:60]}...'"
                )

                await db.execute(
                    text("UPDATE roadmap_templates SET hit_count = hit_count + 1 WHERE id = :id"),
                    {"id": template_id}
                )
                await db.commit()
                return {"tier": "semantic", "template": dict(match), "score": score}
        except Exception as e:
            logger.warning(f"pgvector semantic cache lookup failed (non-fatal): {e}")

    logger.info(f"❌ Cache MISS for: '{goal_text[:60]}...'")
    return {"tier": "miss", "template": None, "score": 0.0}


# ── Cache Write-back ──────────────────────────────────────────────────

async def save_to_cache(
    goal_text: str,
    syllabus_json: list[dict],
    db: AsyncSession,
    detected_entity: Optional[str] = None,
    verification_passed: bool = True,
) -> Optional[str]:
    """
    Save a newly generated roadmap into the cache (pgvector table).

    Entity-linked templates (exams, certs) expire in 90 days —
    syllabi get revised yearly. Generic study goals expire in 365 days.

    Returns the template_id (UUID string) on success, None on failure.
    """
    import uuid

    goal_hash = get_goal_hash(goal_text)
    template_id = str(uuid.uuid4())

    # Generate embedding vector if embedder is available
    embedder = _get_embedder()
    vector_str = None
    if embedder:
        try:
            vector = embedder.encode(normalize_goal(goal_text)).tolist()
            vector_str = "[" + ",".join(map(str, vector)) + "]"
        except Exception as e:
            logger.warning(f"Failed to generate vector for cache save: {e}")

    # Entity-linked syllabi expire faster since exam patterns change
    expiry_days = 90 if detected_entity else 365
    expires_at = datetime.now(timezone.utc) + timedelta(days=expiry_days)

    try:
        # Check if a template with this goal_hash already exists
        result = await db.execute(
            text("SELECT id FROM roadmap_templates WHERE goal_hash = :hash LIMIT 1"),
            {"hash": goal_hash}
        )
        existing = result.mappings().first()
        if existing:
            existing_id = str(existing["id"])
            if vector_str:
                await db.execute(
                    text(
                        "UPDATE roadmap_templates SET syllabus_json = :syllabus, "
                        "embedding = CAST(:vec AS vector), expires_at = :expires WHERE id = :id"
                    ),
                    {
                        "id": existing_id,
                        "syllabus": json.dumps(syllabus_json),
                        "vec": vector_str,
                        "expires": expires_at,
                    }
                )
            else:
                await db.execute(
                    text(
                        "UPDATE roadmap_templates SET syllabus_json = :syllabus, "
                        "expires_at = :expires WHERE id = :id"
                    ),
                    {
                        "id": existing_id,
                        "syllabus": json.dumps(syllabus_json),
                        "expires": expires_at,
                    }
                )
            await db.flush()
            logger.info(f"💾 Updated existing cached template: {existing_id}")
            return existing_id

        # Save brand new template to Postgres pgvector table
        if vector_str:
            await db.execute(
                text(
                    "INSERT INTO roadmap_templates "
                    "(id, goal_hash, goal_text, embedding, syllabus_json, "
                    "detected_entity, verification_passed, expires_at) "
                    "VALUES (:id, :hash, :text, CAST(:vec AS vector), :syllabus, :entity, :verified, :expires)"
                ),
                {
                    "id": template_id,
                    "hash": goal_hash,
                    "text": goal_text,
                    "vec": vector_str,
                    "syllabus": json.dumps(syllabus_json),
                    "entity": detected_entity,
                    "verified": verification_passed,
                    "expires": expires_at,
                }
            )
        else:
            await db.execute(
                text(
                    "INSERT INTO roadmap_templates "
                    "(id, goal_hash, goal_text, syllabus_json, "
                    "detected_entity, verification_passed, expires_at) "
                    "VALUES (:id, :hash, :text, :syllabus, :entity, :verified, :expires)"
                ),
                {
                    "id": template_id,
                    "hash": goal_hash,
                    "text": goal_text,
                    "syllabus": json.dumps(syllabus_json),
                    "entity": detected_entity,
                    "verified": verification_passed,
                    "expires": expires_at,
                }
            )
        await db.flush()

        logger.info(
            f"💾 Cached template in pgvector: {template_id} "
            f"(entity={detected_entity or 'none'}, verified={verification_passed}, expires_in={expiry_days}d)"
        )
        return template_id

    except Exception as e:
        logger.error(f"Failed to save to cache (non-fatal): {e}")
        return None


# ── Cache Invalidation ────────────────────────────────────────────────

async def invalidate_template(template_id: str, db: AsyncSession):
    """Remove a bad template from cache."""
    try:
        await db.execute(
            text("DELETE FROM roadmap_templates WHERE id = :id"),
            {"id": template_id}
        )
        await db.commit()
        logger.info(f"🗑️ Invalidated template: {template_id}")
    except Exception as e:
        logger.error(f"Template invalidation failed: {e}")
