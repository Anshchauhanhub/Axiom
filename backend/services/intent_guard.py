"""
Intent Guard — Edxiom's First & Last Shield.

Analogous to the safety-engine.ts in the described medical chatbot architecture.

PRE-CHECK  (before any LLM call):
  - CRISIS detection   → instant empathy card, no LLM call, no tokens wasted
  - ABUSE detection    → instant block card
  - OFF_TOPIC          → soft redirect (soft mode: still passes through, just adds a note)

POST-CHECK (after LLM generates output):
  - Syllabus boundary check: flags topics outside the user's current goal/entity
  - Hallucinated URL stripping
  - Exam-date accuracy check against EXAM_REGISTRY

All pre-checks are pure Python (regex + keyword sets) → $0 cost, <1ms latency.
"""

import re
import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("edxiom.intent_guard")


# ── Intent Classification ─────────────────────────────────────────────

class IntentResult(str, Enum):
    SAFE = "safe"
    CRISIS = "crisis"              # Burnout / panic / giving up → empathy card
    EXAM_EMERGENCY = "exam_emergency"  # Exam tomorrow panic → priority coaching card
    ABUSE = "abuse"                # Prompt injection / harmful roleplay → block
    OFF_TOPIC = "off_topic"        # Unrelated to study → soft redirect (still passes)


@dataclass
class GuardResult:
    intent: IntentResult
    short_circuit_response: Optional[dict]  # Non-None → return this without calling LLM
    confidence: float = 1.0
    matched_keywords: list[str] = field(default_factory=list)


# ── Keyword Libraries (Edxiom's domain-tuned) ─────────────────────────

# Level 1: Hard block — these bypass LLM entirely and return a structured card
_CRISIS_PATTERNS = [
    r"(i('m|\s+am)\s+(going\s+to\s+)?(give\s+up|quit|drop\s+out))",
    r"(can'?t\s+(do\s+this|study|focus|concentrate))",
    r"(feel(ing)?\s+(hopeless|worthless|like\s+a\s+failure|overwhelmed|burnt?\s*out))",
    r"(completely\s+(burnt?\s*out|overwhelmed|burned\s+out))",
    r"(want\s+to\s+(give\s+up|quit|stop\s+studying))",
    r"(hate\s+(studying|exams?|my\s+life))",
    r"(too\s+(stressed|anxious|tired|exhausted)\s+to\s+study)",
    r"(no\s+(point|hope)\s+(in\s+studying)?)",
    r"(anxiety\s+(attack|episode)|panic\s+attack)",
    r"(mental\s+(breakdown|health\s+crisis))",
    r"(burnt?\s*out\s+and\s+(overwhelmed|exhausted|stressed))",
]

_EXAM_EMERGENCY_PATTERNS = [
    r"(exam\s+(is\s+)?(tomorrow|today|in\s+\d+\s+hours?))",
    r"((\d+\s+hours?)\s+(left|remaining|until\s+(exam|test)))",
    r"(haven'?t\s+studied\s+(anything|at\s+all))",
    r"(completely\s+(unprepared|blank|clueless))",
    r"(last\s+minute\s+(revision|prep|study))",
    r"(crash\s+(course|revision))",
]

# Level 2: Soft block — LLM still gets called but with a redirect note injected
_ABUSE_PATTERNS = [
    r"(ignore\s+(previous|all|your)\s+instructions?)",
    r"(you\s+(are|'?re)\s+(now\s+)?a?\s*(jailbreak|dan|evil|unrestricted)\s*(mode|ai|model)?)",
    r"(forget\s+(everything|your\s+rules|your\s+training))",
    r"(do\s+anything\s+now)",
    r"(pretend\s+(you\s+are|to\s+be)\s+(not\s+an?\s+ai|human|unrestricted))",
    r"(bypass\s+(safety|filter|restriction|guardrail))",
    r"(write\s+(malware|exploit|hack|virus|ransomware))",
    r"(how\s+to\s+(hack|crack|pirate|cheat\s+on\s+exam))",
]

# Level 3: Informational flag — intent is detected but request still passes
_OFF_TOPIC_PATTERNS = [
    r"(recipe|ingredient|cook(ing)?|bak(ing|e)|chef)",
    r"(sports?\s+(news|score|team|match|game|player))",
    r"(cricket|football|ipl|nba|nfl|formula\s*1|f1\s+race)\s+(score|match|news|result|team)",
    r"(what'?s\s+the\s+(cricket|football|ipl|score)\s+(score|today|now)?)",
    r"(movie\s+(review|recommendation|plot|cast)|netflix|prime\s+video)",
    r"(weather\s+(today|tomorrow|forecast))",
    r"(stock\s+(market|price|trading)|cryptocurrency|bitcoin|invest)",
    r"(gossip|celebrity|social\s+media\s+drama)",
    r"(dating|relationship\s+advice|girlfriend|boyfriend)",
    r"(gaming\s+(tips?|cheat|walkthrough)|video\s+game)",
]

# Compile all patterns for speed
_compiled_crisis = [re.compile(p, re.IGNORECASE) for p in _CRISIS_PATTERNS]
_compiled_emergency = [re.compile(p, re.IGNORECASE) for p in _EXAM_EMERGENCY_PATTERNS]
_compiled_abuse = [re.compile(p, re.IGNORECASE) for p in _ABUSE_PATTERNS]
_compiled_off_topic = [re.compile(p, re.IGNORECASE) for p in _OFF_TOPIC_PATTERNS]


# ── Structured Response Cards ──────────────────────────────────────────

def _build_crisis_card() -> dict:
    """
    Instant empathy response for a user showing signs of burnout/giving up.
    Skips the LLM entirely — warm, human, immediate.
    """
    return {
        "message": (
            "Hey — I hear you, and that feeling is completely valid. Burnout is real, "
            "and it happens to every serious student at some point.\n\n"
            "**Right now, do this:**\n"
            "- 🧘 Take a 5-minute break. Stand up, breathe, get water.\n"
            "- 📵 Put your phone face-down for 10 minutes.\n"
            "- 📓 Write down ONE thing you *do* understand — anchor yourself there.\n\n"
            "You haven't failed. You're exhausted. That's a different problem with a solvable solution. "
            "Come back and tell me exactly where you're stuck — we'll break it into the smallest possible piece together."
        ),
        "phase": "chat",
        "mood": 2,
        "intent_intercepted": "crisis",
        "draft_roadmap": None,
        "goal_title": None,
    }


def _build_exam_emergency_card() -> dict:
    """
    Priority coaching card for 'exam is tomorrow' panic situations.
    """
    return {
        "message": (
            "🚨 **Exam Emergency Protocol Activated.**\n\n"
            "Okay, no time to waste — here's your battle plan:\n\n"
            "**The 3-Pass Rapid Revision Method:**\n"
            "1. **Pass 1 (30 min):** Open every chapter. Read *only* the headings and bold text. "
            "Build a mental map of what exists.\n"
            "2. **Pass 2 (2–3 hrs):** Focus on HIGH-WEIGHTAGE topics only. "
            "Attempt previous year questions for each topic.\n"
            "3. **Pass 3 (1 hr before exam):** Review formulas, key definitions, and your own weak spots only.\n\n"
            "**Critical rules:**\n"
            "- ❌ Do NOT start any new concept from scratch\n"
            "- ✅ Prioritize topics you 60–70% know (easiest to boost)\n"
            "- 💤 Sleep at least 6 hours. Seriously. Your brain consolidates during sleep.\n\n"
            "Tell me your subject or exam and I'll give you the exact high-priority topic list right now."
        ),
        "phase": "chat",
        "mood": 2,
        "intent_intercepted": "exam_emergency",
        "draft_roadmap": None,
        "goal_title": None,
    }


def _build_abuse_card() -> dict:
    return {
        "message": (
            "I noticed your message was trying to alter my behavior or bypass my guidelines. "
            "I'm here strictly as your study coach — I can't help with that. "
            "Let's get back to your learning goals! What are you studying today?"
        ),
        "phase": "chat",
        "mood": 1,
        "intent_intercepted": "abuse",
        "draft_roadmap": None,
        "goal_title": None,
    }


def _build_off_topic_note() -> str:
    """Returns an inline note to prepend to the system prompt (soft mode — doesn't block)."""
    return (
        "\n\n[SYSTEM NOTE: The user's message appears to be off-topic from learning/studying. "
        "Gently acknowledge their question, but steer the conversation back to their study goals. "
        "Keep your response brief and redirect warmly.]\n"
    )


# ── Pre-Check Entry Point ──────────────────────────────────────────────

def check_intent(text: str) -> GuardResult:
    """
    PRE-CHECK: Classify the user's intent before any LLM call.

    Returns a GuardResult. If `short_circuit_response` is not None,
    the caller should return it directly without calling the LLM.
    
    This function is pure Python (regex only), cost $0, and runs in <1ms.
    """
    text_stripped = text.strip()
    
    # Priority 1: Abuse (hard block — never touches LLM)
    for pattern in _compiled_abuse:
        m = pattern.search(text_stripped)
        if m:
            logger.warning(f"🚫 Intent Guard: ABUSE detected — '{m.group()[:50]}'")
            return GuardResult(
                intent=IntentResult.ABUSE,
                short_circuit_response=_build_abuse_card(),
                matched_keywords=[m.group()],
            )

    # Priority 2: Exam Emergency (specific panic → coaching card)
    matched_emergency = []
    for pattern in _compiled_emergency:
        m = pattern.search(text_stripped)
        if m:
            matched_emergency.append(m.group())

    if len(matched_emergency) >= 1:
        logger.info(f"🚨 Intent Guard: EXAM_EMERGENCY detected — {matched_emergency}")
        return GuardResult(
            intent=IntentResult.EXAM_EMERGENCY,
            short_circuit_response=_build_exam_emergency_card(),
            matched_keywords=matched_emergency,
        )

    # Priority 3: Crisis (burnout/despair → empathy card)
    matched_crisis = []
    for pattern in _compiled_crisis:
        m = pattern.search(text_stripped)
        if m:
            matched_crisis.append(m.group())

    if matched_crisis:
        logger.info(f"💔 Intent Guard: CRISIS detected — {matched_crisis}")
        return GuardResult(
            intent=IntentResult.CRISIS,
            short_circuit_response=_build_crisis_card(),
            matched_keywords=matched_crisis,
        )

    # Priority 4: Off-topic (soft mode — passes through, injects redirect note)
    matched_off_topic = []
    for pattern in _compiled_off_topic:
        m = pattern.search(text_stripped)
        if m:
            matched_off_topic.append(m.group())

    if matched_off_topic:
        logger.info(f"📵 Intent Guard: OFF_TOPIC detected (soft redirect) — {matched_off_topic}")
        return GuardResult(
            intent=IntentResult.OFF_TOPIC,
            short_circuit_response=None,  # Soft mode: still passes through
            matched_keywords=matched_off_topic,
        )

    # All clear
    return GuardResult(intent=IntentResult.SAFE, short_circuit_response=None)


# ── Post-Check Entry Point ─────────────────────────────────────────────

def verify_output(
    response: dict,
    active_entity: Optional[str] = None,
    syllabus_task_titles: Optional[list[str]] = None,
) -> dict:
    """
    POST-CHECK: Scan and augment the AI's generated response before sending to user.

    Checks:
    1. Syllabus boundary — warns if AI discusses topics outside user's current goal entity
    2. Strips clearly hallucinated resource URLs (basic format check)
    3. Returns an augmented response dict (never mutates the input in place)

    Args:
        response: The parsed response dict from generate_onboarding_response()
        active_entity: The exam entity linked to the user's active roadmap (e.g. "GATE DA")
        syllabus_task_titles: List of task titles in the user's current roadmap
    """
    if not response or "message" not in response:
        return response

    message: str = response.get("message", "")
    warnings = []

    # ── Check 1: Syllabus Boundary ────────────────────────────────────
    # If user is on GATE DA but AI starts talking about GATE CS/AR/ME topics, flag it
    if active_entity:
        # Build cross-entity contamination check
        from services.exam_resolver import EXAM_REGISTRY
        
        # Find sibling entities (same exam family but different branch)
        active_entity_lower = active_entity.lower()
        
        for entity in EXAM_REGISTRY:
            # Skip the user's own entity
            if entity.canonical_name.lower() in active_entity_lower:
                continue
            # Check if sibling entity's key topics appear in the AI's response
            contamination_hits = [
                topic for topic in entity.key_topics
                if topic.lower() in message.lower()
                and len(topic) > 10  # Avoid false positives on short words
            ]
            if len(contamination_hits) >= 2:
                warnings.append(
                    f"⚠️ **Scope Note**: Some topics mentioned above "
                    f"(e.g., *{contamination_hits[0]}*) may belong to "
                    f"a different syllabus. Your active roadmap is focused on "
                    f"**{active_entity}** — verify these topics are relevant to your goal."
                )
                logger.info(
                    f"🔬 Post-check: Syllabus boundary violation detected. "
                    f"Active={active_entity}, contamination from {entity.canonical_name}: {contamination_hits}"
                )
                break  # One warning is enough

    # ── Check 2: Hallucinated URL Stripping ───────────────────────────
    # Remove markdown-style links where the URL looks clearly fake/malformed
    bad_url_pattern = re.compile(r'\[([^\]]+)\]\((https?://[^\)]+)\)')
    
    def _check_url(match):
        url = match.group(2)
        # Flag obviously hallucinated patterns: localhost, internal IPs, placeholder domains
        suspicious = any(s in url.lower() for s in [
            "localhost", "example.com", "placeholder", "your-site", "domain.com",
            "site.here", "link-here", "url-here", "INSERT_URL"
        ])
        if suspicious:
            logger.info(f"🔗 Post-check: Stripped suspicious URL: {url}")
            return match.group(1)  # Return just the link text, no URL
        return match.group(0)  # Keep the original
    
    cleaned_message = bad_url_pattern.sub(_check_url, message)

    # ── Assemble final response ───────────────────────────────────────
    if warnings or cleaned_message != message:
        augmented = dict(response)  # Shallow copy
        if warnings:
            augmented["message"] = cleaned_message + "\n\n---\n" + "\n\n".join(warnings)
        else:
            augmented["message"] = cleaned_message
        logger.info(f"✅ Post-check complete: {len(warnings)} warning(s) appended")
        return augmented

    logger.debug("✅ Post-check clean: no issues found")
    return response


def get_off_topic_system_note() -> str:
    """Return the inline system note to inject when OFF_TOPIC is detected (soft mode)."""
    return _build_off_topic_note()
