"""
LLM Provider Chain — Edxiom's Resilient Fallback Architecture.

Analogous to providers/index.ts in the described medical chatbot architecture.

Upgrades from: basic same-model 3-attempt retry in groq.py
Upgrades to:   tiered model degradation with rich logging and graceful failure response

Provider Priority:
  Tier 1 (Primary):  llama-3.3-70b-versatile  — quality, structured JSON
  Tier 2 (Fallback): llama-3.1-8b-instant      — fast, token-efficient
  Tier 3 (Degraded): Static fallback response  — never returns a 500 to the user

Usage:
    from services.provider_chain import call_with_provider_chain

    result = await call_with_provider_chain(
        system_prompt="...",
        messages=[...],
        purpose="onboarding_chat",  # for logging
        require_json=True,          # adds JSON formatting hints
    )
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from typing import Optional

from groq import AsyncGroq, RateLimitError, APIConnectionError, APIError

logger = logging.getLogger("edxiom.provider_chain")


# ── Provider Response Object ──────────────────────────────────────────

@dataclass
class ProviderResponse:
    text: str
    model_used: str
    tier: int             # 1=primary 70B, 2=fallback 8B, 3=degraded static
    latency_ms: float
    degraded: bool = False
    error: Optional[str] = None


import os

_TIER_1_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
_TIER_2_MODEL = os.getenv("GROQ_MODEL_FAST", "openai/gpt-oss-20b")

# Static fallback response for when all providers fail
_DEGRADED_RESPONSE = {
    "message": (
        "I'm experiencing high load right now. "
        "Please give me a moment and try your message again. "
        "Your progress is saved."
    ),
    "phase": "chat",
    "mood": 3,
    "draft_roadmap": None,
    "goal_title": None,
}

# Errors that trigger model downgrade vs errors that should be retried on same model
_DOWNGRADE_ERRORS = (RateLimitError, APIConnectionError)
_RETRY_ERRORS = (APIError,)

_RETRY_DELAYS_TIER1 = [1.0, 2.0]    # 2 retries on tier 1 before downgrading
_RETRY_DELAYS_TIER2 = [1.5]         # 1 retry on tier 2 before giving up


# ── Core Chain Logic ──────────────────────────────────────────────────

async def call_with_provider_chain(
    system_prompt: str,
    messages: list[dict],
    purpose: str = "unknown",
    temperature: float = 0.7,
    max_tokens: int = 4096,
    require_json: bool = False,
) -> ProviderResponse:
    """
    Call the LLM through a tiered provider chain with automatic fallback.

    Tier 1 → Tier 2 → Degraded Static Response
    Never raises an exception — always returns a ProviderResponse.

    Args:
        system_prompt: The system instructions to prepend.
        messages: The conversation history in [{role, content}] format.
        purpose: A label for logging (e.g., "onboarding_chat", "quiz_gen").
        temperature: LLM sampling temperature.
        max_tokens: Max tokens for the response.
        require_json: If True, adds a JSON formatting reminder to the system prompt.
    """
    import os
    from groq import AsyncGroq

    api_key = os.getenv("GROQ_API_KEY")
    client = AsyncGroq(api_key=api_key)

    effective_system = system_prompt
    if require_json:
        effective_system = system_prompt + (
            "\n\nCRITICAL: Return ONLY valid JSON. No markdown fences. No prose outside the JSON object."
        )

    full_messages = [{"role": "system", "content": effective_system}] + messages

    # ── Tier 1: Primary (70B) ─────────────────────────────────────────
    tier_1_result = await _attempt_provider(
        client=client,
        model=_TIER_1_MODEL,
        messages=full_messages,
        temperature=temperature,
        max_tokens=max_tokens,
        retry_delays=_RETRY_DELAYS_TIER1,
        tier=1,
        purpose=purpose,
    )
    if tier_1_result:
        return tier_1_result

    # ── Tier 2: Fallback (8B) ─────────────────────────────────────────
    logger.warning(f"⬇️ Provider chain: Downgrading to Tier 2 ({_TIER_2_MODEL}) for '{purpose}'")
    tier_2_result = await _attempt_provider(
        client=client,
        model=_TIER_2_MODEL,
        messages=full_messages,
        temperature=temperature,
        max_tokens=max_tokens,
        retry_delays=_RETRY_DELAYS_TIER2,
        tier=2,
        purpose=purpose,
    )
    if tier_2_result:
        return tier_2_result

    # ── Tier 3: Degraded Static Response ─────────────────────────────
    logger.error(f"❌ Provider chain: All providers failed for '{purpose}'. Returning degraded response.")
    return ProviderResponse(
        text=json.dumps(_DEGRADED_RESPONSE),
        model_used="static_fallback",
        tier=3,
        latency_ms=0.0,
        degraded=True,
        error="All providers exhausted",
    )


async def _attempt_provider(
    client: AsyncGroq,
    model: str,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
    retry_delays: list[float],
    tier: int,
    purpose: str,
) -> Optional[ProviderResponse]:
    """
    Attempt a single provider model with retries.
    Returns None if all attempts fail, so the chain can try the next tier.
    """
    for attempt, delay in enumerate([0.0] + retry_delays):
        if delay > 0:
            logger.info(f"🔄 Tier {tier} retry {attempt} for '{purpose}' (waiting {delay}s)")
            await asyncio.sleep(delay)

        t_start = time.perf_counter()
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            latency = (time.perf_counter() - t_start) * 1000
            text = response.choices[0].message.content

            logger.info(
                f"✅ Tier {tier} ({model}) succeeded for '{purpose}' "
                f"in {latency:.0f}ms ({len(text)} chars)"
            )
            return ProviderResponse(
                text=text,
                model_used=model,
                tier=tier,
                latency_ms=round(latency, 2),
            )

        except _DOWNGRADE_ERRORS as e:
            latency = (time.perf_counter() - t_start) * 1000
            error_type = type(e).__name__
            logger.warning(
                f"⚠️ Tier {tier} ({model}) {error_type} on attempt {attempt + 1}: {str(e)[:100]}"
            )
            if attempt >= len(retry_delays):
                # Exhausted retries for this tier — fall through to next tier
                return None
            continue

        except _RETRY_ERRORS as e:
            logger.error(f"❌ Tier {tier} ({model}) API error (non-retryable): {e}")
            return None  # API errors (4xx etc.) won't benefit from retry

        except Exception as e:
            logger.error(f"❌ Tier {tier} ({model}) unexpected error: {e}", exc_info=True)
            return None

    return None  # All retries for this tier exhausted


# ── Convenience wrapper for simple calls ──────────────────────────────

async def call_chain_simple(
    system_prompt: str,
    user_prompt: str,
    purpose: str = "simple",
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    """
    Simple wrapper for single-turn calls that don't need full message history.
    Returns raw text string. Falls back gracefully.
    """
    messages = [{"role": "user", "content": user_prompt}]
    result = await call_with_provider_chain(
        system_prompt=system_prompt,
        messages=messages,
        purpose=purpose,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    if result.degraded:
        logger.warning(f"⚠️ Degraded response returned for '{purpose}'")
    return result.text
