"""
Anthropic Haiku 4.5 client — used for grounded nodes in the goal agent.

Why Haiku instead of Groq/Llama for these nodes:
- Better instruction-following (critical for "ONLY use this source material")
- $1/$5 per MTok, still 3x cheaper than Sonnet
- Prompt caching gives 90% off on repeated system prompts / knowledge chunks

Groq (free tier) is kept for casual coaching chat and nudges.
"""

import os
import json
import logging
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("edxiom.anthropic")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
HAIKU_MODEL = os.getenv("HAIKU_MODEL", "claude-haiku-4-5-20251001")

# Lazy-loaded client
_client = None


def _get_client():
    """Lazy-init the Anthropic client."""
    global _client
    if _client is None:
        if not ANTHROPIC_API_KEY:
            logger.warning("⚠️ ANTHROPIC_API_KEY not set. Haiku calls will fall back to Groq.")
            return None
        try:
            import anthropic
            _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            logger.info(f"✅ Anthropic client initialized (model={HAIKU_MODEL})")
        except ImportError:
            logger.warning("⚠️ anthropic package not installed. pip install anthropic")
            return None
    return _client


def _clean_json(raw: str) -> str:
    """Extract clean JSON from LLM output that may contain markdown fences."""
    import re
    cleaned = raw.strip()

    if cleaned.startswith("```"):
        if "\n" in cleaned:
            cleaned = cleaned.split("\n", 1)[1]
        else:
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

    try:
        match = re.search(r'(\{.*\}|\[.*\])', cleaned, re.DOTALL)
        if match:
            cleaned = match.group(0)
    except Exception:
        pass

    return cleaned


# ── Core Haiku call ───────────────────────────────────────────────────

async def call_haiku(
    prompt: str,
    max_tokens: int = 1000,
    system: Optional[str] = None,
    cache_system: bool = False,
) -> str:
    """
    Call Haiku 4.5 with optional prompt caching on the system prompt.

    If cache_system=True, the system prompt is marked with cache_control
    so repeated calls with the same system content get 90% off.

    Falls back to Groq if Anthropic is not configured.
    """
    import asyncio

    client = _get_client()
    if client is None:
        # Fallback to Groq
        logger.info("Haiku unavailable, falling back to Groq")
        from services.groq import call_groq
        return await call_groq(system or "You are a helpful assistant.", prompt)

    # Build messages
    messages = [{"role": "user", "content": prompt}]

    # Build system with optional caching
    system_content = None
    if system:
        if cache_system:
            # Use prompt caching — the system content is marked ephemeral
            # so Anthropic caches it across calls with the same prefix
            system_content = [{
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"}
            }]
        else:
            system_content = system

    try:
        # Run the synchronous Anthropic client in a thread
        response = await asyncio.to_thread(
            client.messages.create,
            model=HAIKU_MODEL,
            max_tokens=max_tokens,
            system=system_content or "",
            messages=messages,
        )
        result = response.content[0].text

        # Log cache performance if available
        if hasattr(response, 'usage'):
            usage = response.usage
            cache_read = getattr(usage, 'cache_read_input_tokens', 0)
            cache_create = getattr(usage, 'cache_creation_input_tokens', 0)
            if cache_read or cache_create:
                logger.info(
                    f"💰 Haiku cache: read={cache_read} tokens, created={cache_create} tokens"
                )

        return result

    except Exception as e:
        logger.error(f"Haiku call failed: {e}")
        # Fallback to Groq on failure
        logger.info("Falling back to Groq after Haiku failure")
        from services.groq import call_groq
        return await call_groq(system or "You are a helpful assistant.", prompt)


# ── Haiku-powered roadmap generation (grounded) ──────────────────────

GROUNDED_SYSTEM_PROMPT = (
    "You are Edxiom AI, a high-accountability learning coach. "
    "Generate an exhaustive, deep-dive learning roadmap as a JSON array. "
    "Each item has: title (task name), parts (array of subtopic strings). "
    "Return ONLY valid JSON, no markdown, no explanation. "
    "Generate 10-15 granular tasks, each with 5-8 detailed sub-parts."
)

GROUNDED_ENTITY_SYSTEM_PROMPT = (
    "You are Edxiom AI, a high-accountability learning coach. "
    "You will be given VERIFIED SOURCE MATERIAL about a specific exam/certification. "
    "Build the roadmap STRICTLY from the topics confirmed in the source material. "
    "Do NOT add topics from your general knowledge that aren't in the source. "
    "Generate an exhaustive learning roadmap as a JSON array. "
    "Each item has: title (task name), parts (array of subtopic strings). "
    "Return ONLY valid JSON, no markdown, no explanation. "
    "Generate 10-15 granular tasks, each with 5-8 detailed sub-parts."
)


async def generate_roadmap_haiku(
    goal_title: str,
    entity_context: Optional[str] = None,
) -> list[dict]:
    """
    Generate a structured roadmap using Haiku 4.5.

    If entity_context is provided (from web search), uses the grounded prompt
    with prompt caching enabled (the system prompt is stable across calls).
    """
    if entity_context:
        system = GROUNDED_ENTITY_SYSTEM_PROMPT
        user_prompt = (
            f"Goal: {goal_title}\n\n"
            f"Verified source material:\n{entity_context}"
        )
    else:
        system = GROUNDED_SYSTEM_PROMPT
        user_prompt = f"Create a detailed learning roadmap for: {goal_title}"

    raw = await call_haiku(
        prompt=user_prompt,
        max_tokens=4000,
        system=system,
        cache_system=True,  # System prompt is stable, cache it
    )

    cleaned = _clean_json(raw)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error in Haiku roadmap: {e}\nRaw: {raw[:500]}")
        raise ValueError(f"Failed to parse Haiku response as JSON: {e}")
