"""
Two-Tier Roadmap Cache — exact-hash (Postgres) + semantic (Pinecone + MiniLM).

Tier 1: Normalize goal text, SHA256 hash, check `roadmap_templates` table.  Free, instant.
Tier 2: Embed with a local MiniLM model, query Pinecone for cosine similarity >= threshold.

On a miss, the caller should run the full LangGraph agent and then call `save_to_cache()`.
"""

import hashlib
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

load_dotenv()

logger = logging.getLogger("edxiom.cache")

# ── Pinecone (lazy-loaded so the app still boots without it) ──────────
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "edxiom-goals")
SIMILARITY_THRESHOLD = float(os.getenv("CACHE_SIMILARITY_THRESHOLD", "0.91"))

_pinecone_index = None
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


def _get_pinecone_index():
    """Lazy-load the Pinecone index."""
    global _pinecone_index
    if _pinecone_index is None and PINECONE_API_KEY:
        try:
            from pinecone import Pinecone
            pc = Pinecone(api_key=PINECONE_API_KEY)
            _pinecone_index = pc.Index(PINECONE_INDEX)
            logger.info(f"✅ Pinecone index '{PINECONE_INDEX}' connected.")
        except Exception as e:
            logger.warning(f"⚠️ Pinecone init failed: {e}. Semantic cache disabled.")
    return _pinecone_index


# ── Normalization ─────────────────────────────────────────────────────

# Common filler words that don't change the meaning of a learning goal
_FILLER_PATTERN = re.compile(
    r'\b(i want to|i need to|i wanna|help me|please|for|learn|study|master|teach me|'
    r'how to|want to|need to|can you|could you|make me|give me a|create a)\b',
    re.IGNORECASE
)


def normalize_goal(text: str) -> str:
    """Normalize a goal string for consistent hashing and comparison."""
    text = text.lower().strip()
    text = _FILLER_PATTERN.sub('', text)
    text = re.sub(r'[^\w\s]', '', text)  # strip punctuation
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def get_goal_hash(text: str) -> str:
    """SHA256 hash of the normalized goal text."""
    return hashlib.sha256(normalize_goal(text).encode()).hexdigest()


# ── Cache Lookup ──────────────────────────────────────────────────────

async def check_cache(goal_text: str, db: AsyncSession) -> dict:
    """
    Two-tier cache check.

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

    # ── Tier 2: Semantic match (local embed + Pinecone query) ─────────
    embedder = _get_embedder()
    index = _get_pinecone_index()

    if embedder and index:
        try:
            vector = embedder.encode(normalize_goal(goal_text)).tolist()
            results = index.query(vector=vector, top_k=1, include_metadata=True)

            if results.get("matches") and results["matches"][0]["score"] >= SIMILARITY_THRESHOLD:
                match = results["matches"][0]
                template_id = match["metadata"]["template_id"]
                logger.info(
                    f"🧠 Cache HIT (semantic, score={match['score']:.3f}) for: '{goal_text[:60]}...'"
                )

                template_result = await db.execute(
                    text(
                        "SELECT * FROM roadmap_templates WHERE id = :id "
                        "AND (expires_at IS NULL OR expires_at > now())"
                    ),
                    {"id": template_id}
                )
                template = template_result.mappings().first()
                if template:
                    await db.execute(
                        text("UPDATE roadmap_templates SET hit_count = hit_count + 1 WHERE id = :id"),
                        {"id": template_id}
                    )
                    await db.commit()
                    return {"tier": "semantic", "template": dict(template), "score": match["score"]}
        except Exception as e:
            logger.warning(f"Semantic cache lookup failed (non-fatal): {e}")

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
    Save a newly generated roadmap into the cache (both Postgres and Pinecone).

    Entity-linked templates (exams, certs) expire in 90 days —
    syllabi get revised yearly.  Generic study goals expire in 365 days.

    Returns the template_id (UUID string) on success, None on failure.
    """
    import uuid
    import json
    from datetime import timedelta

    goal_hash = get_goal_hash(goal_text)
    template_id = str(uuid.uuid4())
    pinecone_vector_id = template_id  # use same ID in Pinecone

    # Entity-linked syllabi expire faster since exam patterns change
    expiry_days = 90 if detected_entity else 365
    expires_at = datetime.now(timezone.utc) + timedelta(days=expiry_days)

    try:
        # Save to Postgres
        await db.execute(
            text(
                "INSERT INTO roadmap_templates "
                "(id, goal_hash, goal_text, pinecone_vector_id, syllabus_json, "
                "detected_entity, verification_passed, expires_at) "
                "VALUES (:id, :hash, :text, :vec_id, :syllabus, :entity, :verified, :expires) "
                "ON CONFLICT (goal_hash) DO NOTHING"
            ),
            {
                "id": template_id,
                "hash": goal_hash,
                "text": goal_text,
                "vec_id": pinecone_vector_id,
                "syllabus": json.dumps(syllabus_json),
                "entity": detected_entity,
                "verified": verification_passed,
                "expires": expires_at,
            }
        )
        await db.commit()

        # Save to Pinecone
        embedder = _get_embedder()
        index = _get_pinecone_index()
        if embedder and index:
            vector = embedder.encode(normalize_goal(goal_text)).tolist()
            index.upsert([(pinecone_vector_id, vector, {"template_id": template_id})])

        logger.info(
            f"💾 Cached template: {template_id} "
            f"(entity={detected_entity or 'none'}, verified={verification_passed}, expires_in={expiry_days}d)"
        )
        return template_id

    except Exception as e:
        logger.error(f"Failed to save to cache: {e}")
        return None


# ── Cache Invalidation ────────────────────────────────────────────────

async def invalidate_template(template_id: str, db: AsyncSession):
    """Remove a bad template from cache (user thumbs-down)."""
    try:
        result = await db.execute(
            text("SELECT pinecone_vector_id FROM roadmap_templates WHERE id = :id"),
            {"id": template_id}
        )
        row = result.mappings().first()

        if row:
            # Remove from Postgres
            await db.execute(
                text("DELETE FROM roadmap_templates WHERE id = :id"),
                {"id": template_id}
            )
            await db.commit()

            # Remove from Pinecone
            index = _get_pinecone_index()
            if index and row["pinecone_vector_id"]:
                index.delete(ids=[row["pinecone_vector_id"]])

            logger.info(f"🗑️ Invalidated template: {template_id}")
    except Exception as e:
        logger.error(f"Template invalidation failed: {e}")
