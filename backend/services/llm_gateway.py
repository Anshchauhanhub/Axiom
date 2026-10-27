"""
LLMGateway — Resilient LLM call wrapper for Edxiom's agent pipeline.

Features:
  - tenacity retries with exponential jitter (wait_random_exponential)
  - asyncio.wait_for per-call timeout (default 25 s)
  - Model fallback map: primary 70B -> fallback 8B -> static emergency string
  - JSON schema enforcement: strips markdown fences, validates json.loads
  - _repair(): one-pass self-heal — sends malformed JSON back to 8B for correction
  - Per-call structured log: run_id, model, latency_ms, char_count
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from groq import AsyncGroq, APIConnectionError, APIStatusError, RateLimitError
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random_exponential,
    before_sleep_log,
    RetryError,
)

logger = logging.getLogger("edxiom.llm_gateway")

# ── Model constants ────────────────────────────────────────────────────

_MODEL_PRIMARY = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
_MODEL_FALLBACK = os.getenv("GROQ_MODEL_FAST", "openai/gpt-oss-20b")

_CALL_TIMEOUT_S = float(os.getenv("LLM_TIMEOUT_S", "25"))
_REPAIR_TIMEOUT_S = float(os.getenv("LLM_REPAIR_TIMEOUT_S", "15"))


# ── Response dataclass ────────────────────────────────────────────────

@dataclass
class GatewayResponse:
    text: str
    model_used: str
    latency_ms: float
    degraded: bool = False
    repaired: bool = False
    run_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    error: Optional[str] = None


# ── Singleton Groq client ─────────────────────────────────────────────

_client: Optional[AsyncGroq] = None


def _get_client() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


# ── JSON normalisation ────────────────────────────────────────────────

_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def _strip_fences(text: str) -> str:
    """Remove ```json ... ``` markdown fences if present."""
    m = _FENCE_RE.search(text)
    if m:
        return m.group(1).strip()
    return text.strip()


def _validate_json(text: str) -> Optional[Any]:
    """Return parsed JSON or None if invalid."""
    try:
        return json.loads(_strip_fences(text))
    except (json.JSONDecodeError, ValueError):
        return None


# ── Core raw call ─────────────────────────────────────────────────────

async def _raw_call(
    client: AsyncGroq,
    model: str,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
    timeout_s: float,
) -> str:
    """Single model call wrapped in asyncio.wait_for timeout."""
    coro = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    resp = await asyncio.wait_for(coro, timeout=timeout_s)
    return resp.choices[0].message.content or ""


# ── Tenacity-wrapped callers ──────────────────────────────────────────

def _make_retrying_caller(model: str, attempts: int = 3):
    """Return a tenacity-wrapped async callable for the given model."""

    @retry(
        retry=retry_if_exception_type((RateLimitError, APIConnectionError, asyncio.TimeoutError)),
        wait=wait_random_exponential(multiplier=1, min=1, max=20),
        stop=stop_after_attempt(attempts),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    async def _call(
        messages: list[dict],
        temperature: float,
        max_tokens: int,
        timeout_s: float,
    ) -> str:
        return await _raw_call(
            client=_get_client(),
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout_s=timeout_s,
        )

    return _call


_primary_caller = _make_retrying_caller(_MODEL_PRIMARY, attempts=3)
_fallback_caller = _make_retrying_caller(_MODEL_FALLBACK, attempts=2)


# ── Self-healing repair ───────────────────────────────────────────────

async def _repair(bad_text: str) -> Optional[str]:
    """One-pass JSON repair: ask 8B to fix malformed JSON. Returns corrected string or None."""
    repair_messages = [
        {
            "role": "system",
            "content": (
                "You are a JSON repair assistant. "
                "The user will give you malformed or partial JSON. "
                "Return ONLY the corrected, complete, valid JSON — no prose, no fences."
            ),
        },
        {
            "role": "user",
            "content": f"Fix this malformed JSON and return only valid JSON:\n\n{bad_text[:4000]}",
        },
    ]
    try:
        repaired = await asyncio.wait_for(
            _raw_call(
                client=_get_client(),
                model=_MODEL_FALLBACK,
                messages=repair_messages,
                temperature=0.1,
                max_tokens=2048,
                timeout_s=_REPAIR_TIMEOUT_S,
            ),
            timeout=_REPAIR_TIMEOUT_S + 2,
        )
        if _validate_json(repaired) is not None:
            return repaired
    except Exception as e:
        logger.warning(f"JSON repair failed: {e}")
    return None


# ── Public LLMGateway class ───────────────────────────────────────────

class LLMGateway:
    """
    Central LLM call gateway for Edxiom's agent pipeline.

    Usage:
        gw = LLMGateway()
        response = await gw.call(
            system_prompt="...",
            user_prompt="...",
            run_id="abc123",
            require_json=True,
        )
    """

    def __init__(
        self,
        timeout_s: float = _CALL_TIMEOUT_S,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ):
        self.timeout_s = timeout_s
        self.temperature = temperature
        self.max_tokens = max_tokens

    async def call(
        self,
        system_prompt: str,
        user_prompt: str,
        run_id: str = "",
        purpose: str = "unknown",
        require_json: bool = False,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> GatewayResponse:
        """
        Call LLM with automatic retry, fallback, JSON validation, and repair.
        Never raises — on total failure returns a degraded GatewayResponse.
        """
        t_start = time.perf_counter()
        temp = temperature if temperature is not None else self.temperature
        tokens = max_tokens if max_tokens is not None else self.max_tokens
        rid = run_id or str(uuid.uuid4())

        system = system_prompt
        if require_json:
            system += (
                "\n\nCRITICAL: Return ONLY valid JSON. No markdown fences. "
                "No prose outside the JSON object."
            )

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_prompt},
        ]

        # ── Primary (70B) ─────────────────────────────────────────────
        model_used = _MODEL_PRIMARY
        try:
            text = await _primary_caller(messages, temp, tokens, self.timeout_s)
            latency = (time.perf_counter() - t_start) * 1000
            text, repaired = await self._validate_and_repair(text, require_json, rid, purpose)
            self._log(rid, purpose, model_used, latency, len(text), degraded=False)
            return GatewayResponse(
                text=text, model_used=model_used, latency_ms=round(latency, 2),
                degraded=False, repaired=repaired, run_id=rid,
            )
        except (RetryError, RateLimitError, APIConnectionError, asyncio.TimeoutError) as e:
            logger.warning(f"[{rid}] Primary ({_MODEL_PRIMARY}) exhausted for '{purpose}': {e}")
        except APIStatusError as e:
            if e.status_code in (400, 401, 403):
                logger.error(f"[{rid}] Non-retryable API error for '{purpose}': {e}")
            else:
                logger.warning(f"[{rid}] API status error for '{purpose}': {e}")
        except Exception as e:
            logger.error(f"[{rid}] Unexpected primary error for '{purpose}': {e}", exc_info=True)

        # ── Fallback (8B) ─────────────────────────────────────────────
        model_used = _MODEL_FALLBACK
        try:
            text = await _fallback_caller(messages, temp, tokens, self.timeout_s)
            latency = (time.perf_counter() - t_start) * 1000
            text, repaired = await self._validate_and_repair(text, require_json, rid, purpose)
            self._log(rid, purpose, model_used, latency, len(text), degraded=True)
            return GatewayResponse(
                text=text, model_used=model_used, latency_ms=round(latency, 2),
                degraded=True, repaired=repaired, run_id=rid,
            )
        except (RetryError, RateLimitError, APIConnectionError, asyncio.TimeoutError) as e:
            logger.warning(f"[{rid}] Fallback ({_MODEL_FALLBACK}) exhausted for '{purpose}': {e}")
        except Exception as e:
            logger.error(f"[{rid}] Unexpected fallback error for '{purpose}': {e}", exc_info=True)

        # ── Emergency static ──────────────────────────────────────────
        latency = (time.perf_counter() - t_start) * 1000
        error_msg = "All LLM tiers exhausted"
        logger.error(f"[{rid}] {error_msg} for '{purpose}'")
        self._log(rid, purpose, "static_fallback", latency, 0, degraded=True)
        return GatewayResponse(
            text="",
            model_used="static_fallback",
            latency_ms=round(latency, 2),
            degraded=True,
            repaired=False,
            run_id=rid,
            error=error_msg,
        )

    async def _validate_and_repair(
        self, text: str, require_json: bool, rid: str, purpose: str
    ) -> tuple[str, bool]:
        if not require_json:
            return text, False
        if _validate_json(text) is not None:
            return text, False
        logger.warning(f"[{rid}] JSON validation failed for '{purpose}' — attempting repair")
        repaired = await _repair(text)
        if repaired:
            logger.info(f"[{rid}] JSON repair succeeded for '{purpose}'")
            return repaired, True
        logger.warning(f"[{rid}] JSON repair also failed for '{purpose}' — returning raw output")
        return text, False

    @staticmethod
    def _log(
        run_id: str,
        purpose: str,
        model: str,
        latency_ms: float,
        chars: int,
        degraded: bool,
    ) -> None:
        logger.info(
            '{"event":"llm_call","run_id":"%s","purpose":"%s","model":"%s",'
            '"latency_ms":%.1f,"chars":%d,"degraded":%s}',
            run_id, purpose, model, latency_ms, chars, str(degraded).lower(),
        )


# ── Module-level singleton ────────────────────────────────────────────

_gateway: Optional[LLMGateway] = None


def get_gateway() -> LLMGateway:
    """Return the module-level LLMGateway singleton."""
    global _gateway
    if _gateway is None:
        _gateway = LLMGateway()
    return _gateway
