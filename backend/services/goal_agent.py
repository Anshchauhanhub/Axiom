"""
LangGraph Goal-Setting Agent — entity-detection + verification pipeline.

Model routing:
    - detect_entity, synthesize_draft → Haiku 4.5 (better instruction-following, ~$0.005/call)
    - casual chat, nudges → Groq Llama 3.3 (free tier, $0)
    - intake, clarify, verify → rule-based (no LLM, $0)

State machine:
    intake → clarify (if needed) → detect_entity → fetch_entity_context (if entity found)
    → synthesize_draft → verify_syllabus → done
"""

import logging
import re
from typing import TypedDict, Optional

logger = logging.getLogger("edxiom.goal_agent")


# ── Agent State ───────────────────────────────────────────────────────

class GoalState(TypedDict):
    user_id: str
    raw_goal: str
    clarified_goal: Optional[str]
    needs_clarification: bool
    clarification_question: Optional[str]
    missing_slots: list[str]  # e.g. ["timeline", "level"]
    detected_entity: Optional[str]       # e.g. "GATE DA", "CAT DILR"
    realtime_context: Optional[str]
    draft_syllabus: Optional[list[dict]]
    verified_syllabus: Optional[list[dict]]
    verification_passed: bool
    conversation_turns: int
    error: Optional[str]


# ── Entity detection prompt ───────────────────────────────────────────

ENTITY_DETECT_PROMPT = """Does this learning goal reference a specific named exam, \
certification, syllabus, or curriculum (e.g. "GATE DA", "CAT", "AWS SAA-C03", \
"UPSC CSE", "JEE Advanced", "NEET", "GRE", "IELTS")?

Rules:
- If yes, return ONLY the exact name/acronym as the user or a domain expert would write it.
- If the goal is generic ("learn Python", "get better at DSA") with no named exam, return "NONE".
- Do not expand acronyms or guess a fuller name than what's implied.

Goal: "{goal}"

Respond with only the entity name or NONE, nothing else."""


# Note: Entity detection and grounded synthesis use Haiku 4.5 via services/anthropic.py.
# Falls back to Groq automatically if ANTHROPIC_API_KEY is not configured.


# ── Node Functions ────────────────────────────────────────────────────

def intake_node(state: GoalState) -> GoalState:
    """
    Parse the raw goal for missing slots.  This is pure rule-based logic —
    no LLM call needed.  Just checks whether the goal is specific enough.
    """
    raw = state["raw_goal"].lower()
    missing = []

    # Check for a timeline/deadline indicator
    has_timeline = bool(re.search(r'\d+\s*(day|week|month|hour)', raw)) or \
                   any(w in raw for w in ["deadline", "by ", "before ", "within "])
    if not has_timeline:
        missing.append("timeline")

    # Check for skill-level indicator
    has_level = any(w in raw for w in [
        "beginner", "intermediate", "advanced", "expert",
        "basics", "fundamentals", "zero", "scratch", "already know",
        "refresh", "deep dive", "mastery"
    ])
    if not has_level:
        missing.append("level")

    state["missing_slots"] = missing
    state["needs_clarification"] = len(missing) > 0
    state["conversation_turns"] = state.get("conversation_turns", 0)

    logger.info(f"Intake: missing_slots={missing}, needs_clarification={state['needs_clarification']}")
    return state


def build_clarification_question(state: GoalState) -> GoalState:
    """
    Generate a natural-language follow-up question based on missing slots.
    No LLM call — template-based for speed and zero cost.
    """
    raw = state["raw_goal"]
    missing = state.get("missing_slots", [])
    questions = []

    if "timeline" in missing:
        questions.append("What's your target timeline? (e.g., 2 weeks, 3 months, before an exam date)")
    if "level" in missing:
        questions.append(f"What's your current level with **{raw}**? (beginner / intermediate / advanced)")

    state["clarification_question"] = " Also, ".join(questions)
    state["needs_clarification"] = True
    state["conversation_turns"] += 1
    return state


def apply_clarification(state: GoalState, user_reply: str) -> GoalState:
    """
    Merge the user's clarification reply into the goal.
    Called when the user responds to a follow-up question.
    """
    state["clarified_goal"] = f"{state['raw_goal']} — {user_reply}"
    state["needs_clarification"] = False
    state["missing_slots"] = []
    state["conversation_turns"] += 1
    return state


# ── Entity Detection (replaces keyword matching) ─────────────────────

async def detect_entity_node(state: GoalState) -> GoalState:
    """
    Cheap Haiku call (~$0.0001) to detect if the goal references a specific
    named exam, certification, or curriculum.  This catches "GATE DA"
    without needing "latest" or "2026" in the text.

    Uses Haiku for better instruction-following on this classification task.
    Falls back to Groq if Haiku is not configured.
    """
    from services.anthropic import call_haiku

    goal = state.get("clarified_goal") or state["raw_goal"]

    try:
        response = await call_haiku(
            prompt=ENTITY_DETECT_PROMPT.format(goal=goal),
            max_tokens=20,
        )
        entity = response.strip().strip('"').strip("'")
        state["detected_entity"] = None if entity.upper() == "NONE" else entity
        logger.info(f"🔍 Entity detection (Haiku): '{goal[:60]}...' → {state['detected_entity'] or 'NONE'}")
    except Exception as e:
        logger.warning(f"Entity detection failed (non-fatal, treating as no entity): {e}")
        state["detected_entity"] = None

    return state


# ── Mandatory search for detected entities ────────────────────────────

async def fetch_entity_context_node(state: GoalState) -> GoalState:
    """
    If an entity was detected, ALWAYS search for its official syllabus.
    No confidence threshold — the cost of one extra search is trivial
    next to the cost of shipping the wrong syllabus to thousands of users.
    """
    from services.search import search_internet

    entity = state["detected_entity"]
    query = f"{entity} official syllabus exam pattern latest"

    logger.info(f"🌐 Fetching entity context for: '{entity}'")
    results = await search_internet(query, max_results=5)

    # Truncate to keep the prompt reasonable
    state["realtime_context"] = results[:3000] if results else ""
    return state


# ── Draft generation — Haiku for grounded, Groq for generic ───────────

async def synthesize_draft_node(state: GoalState) -> GoalState:
    """
    Build the roadmap draft using Haiku 4.5.

    If we have entity context from a search, Haiku is instructed to ONLY
    use verified source material — its instruction-following is significantly
    better than Llama 3.3 for this constraint.

    Falls back to Groq automatically if Haiku is not configured.
    """
    from services.anthropic import generate_roadmap_haiku

    goal_text = state.get("clarified_goal") or state["raw_goal"]
    context = state.get("realtime_context", "") or None

    try:
        syllabus = await generate_roadmap_haiku(
            goal_title=goal_text,
            entity_context=context,
        )
        state["draft_syllabus"] = syllabus
        state["error"] = None
        logger.info(f"✅ Draft roadmap synthesized (Haiku): {len(syllabus)} tasks")
    except Exception as e:
        state["error"] = str(e)
        logger.error(f"❌ Draft synthesis failed: {e}")

    return state


# ── Verification — safety net for silent hallucination ────────────────

def _extract_topic_list(syllabus: list[dict]) -> set[str]:
    """Extract a flat set of normalized topic keywords from a syllabus."""
    topics = set()
    for task in syllabus:
        # Extract keywords from task title
        title = task.get("title", "").lower()
        for word in re.split(r'[\s:,\-–—/&]+', title):
            word = word.strip()
            if len(word) > 2:
                topics.add(word)
        # Extract keywords from parts
        for part in task.get("parts", []):
            part_text = part if isinstance(part, str) else str(part)
            for word in re.split(r'[\s:,\-–—/&]+', part_text.lower()):
                word = word.strip()
                if len(word) > 2:
                    topics.add(word)
    return topics


def _extract_topics_from_text(text: str) -> set[str]:
    """Extract a flat set of normalized topic keywords from raw search text."""
    topics = set()
    for word in re.split(r'[\s:,\-–—/&\.\(\)]+', text.lower()):
        word = word.strip()
        if len(word) > 2:
            topics.add(word)
    return topics


def _jaccard_similarity(set_a: set, set_b: set) -> float:
    """Jaccard similarity between two sets."""
    if not set_a or not set_b:
        return 0.0
    intersection = set_a & set_b
    union = set_a | set_b
    return len(intersection) / len(union)


def _build_syllabus_from_source_topics(source_text: str, goal_text: str) -> list[dict]:
    """
    Template-fill fallback: extract structured topics from the search results
    and organize them into a Task/Part hierarchy.  No LLM call — just parsing.
    """
    lines = source_text.split('\n')
    topics = []

    for line in lines:
        line = line.strip()
        # Look for lines that look like topic headings
        if line and len(line) > 5 and not line.startswith(('http', 'Source:', 'Title:', '---')):
            # Clean up the line
            cleaned = re.sub(r'^[\d\.\)\-\*]+\s*', '', line).strip()
            if cleaned and len(cleaned) > 3 and len(cleaned) < 100:
                topics.append(cleaned)

    # Deduplicate while preserving order
    seen = set()
    unique_topics = []
    for t in topics:
        normalized = t.lower().strip()
        if normalized not in seen and len(normalized) > 3:
            seen.add(normalized)
            unique_topics.append(t)

    # Group into modules of ~5 topics each
    chunk_size = 5
    syllabus = []
    for i in range(0, len(unique_topics), chunk_size):
        chunk = unique_topics[i:i + chunk_size]
        module_title = f"Module {len(syllabus) + 1}: {chunk[0]}" if chunk else f"Module {len(syllabus) + 1}"
        syllabus.append({
            "title": module_title,
            "parts": chunk
        })

    # If we couldn't extract enough structure, return an empty list
    # so the caller knows to fall back to the draft anyway
    if len(syllabus) < 2:
        return []

    return syllabus


def verify_syllabus_node(state: GoalState) -> GoalState:
    """
    Compare the draft syllabus against the scraped source material.
    If the overlap is too low, the draft hallucinated — fall back to
    a source-derived structure.
    """
    if not state.get("detected_entity") or not state.get("realtime_context"):
        # No named entity to verify against — draft stands as-is
        state["verified_syllabus"] = state.get("draft_syllabus")
        state["verification_passed"] = True
        return state

    draft = state.get("draft_syllabus")
    if not draft:
        state["verified_syllabus"] = None
        state["verification_passed"] = False
        return state

    draft_topics = _extract_topic_list(draft)
    source_topics = _extract_topics_from_text(state["realtime_context"])

    overlap = _jaccard_similarity(draft_topics, source_topics)
    logger.info(
        f"🔬 Verification: entity='{state['detected_entity']}', "
        f"draft_topics={len(draft_topics)}, source_topics={len(source_topics)}, "
        f"jaccard={overlap:.3f}"
    )

    if overlap >= 0.5:
        # Draft is grounded — pass verification
        state["verified_syllabus"] = draft
        state["verification_passed"] = True
    else:
        # Draft diverged from source — try building from source directly
        logger.warning(
            f"⚠️ Verification FAILED for entity '{state['detected_entity']}' "
            f"(jaccard={overlap:.3f} < 0.5). Attempting source-derived fallback."
        )
        source_syllabus = _build_syllabus_from_source_topics(
            state["realtime_context"],
            state.get("clarified_goal") or state["raw_goal"]
        )

        if source_syllabus:
            state["verified_syllabus"] = source_syllabus
            state["verification_passed"] = False
            logger.info(f"🔧 Source-derived fallback produced {len(source_syllabus)} modules")
        else:
            # Couldn't build from source either — accept the draft with a warning
            state["verified_syllabus"] = draft
            state["verification_passed"] = False
            logger.warning("⚠️ Source-derived fallback also failed. Using unverified draft.")

    return state


# ── Orchestrator ──────────────────────────────────────────────────────

async def run_goal_agent(
    user_id: str,
    raw_goal: str,
    clarification_reply: Optional[str] = None,
) -> GoalState:
    """
    Run the goal-setting agent pipeline.

    Pipeline: intake → clarify? → detect_entity → fetch_entity_context? → synthesize_draft → verify

    If `clarification_reply` is None, this is the first invocation.
    If provided, this is a follow-up after the user answered a clarification question.

    Returns the final GoalState.  Check:
      - state["needs_clarification"]: True → return clarification_question to user, wait for reply
      - state["verified_syllabus"]: not None → roadmap is ready
      - state["error"]: not None → something went wrong
    """
    state: GoalState = {
        "user_id": user_id,
        "raw_goal": raw_goal,
        "clarified_goal": None,
        "needs_clarification": False,
        "clarification_question": None,
        "missing_slots": [],
        "detected_entity": None,
        "realtime_context": None,
        "draft_syllabus": None,
        "verified_syllabus": None,
        "verification_passed": False,
        "conversation_turns": 0,
        "error": None,
    }

    # ── If this is a clarification follow-up, merge and skip intake ───
    if clarification_reply:
        state = apply_clarification(state, clarification_reply)
    else:
        # ── Step 1: Intake — check for missing slots ──────────────────
        state = intake_node(state)

        if state["needs_clarification"]:
            state = build_clarification_question(state)
            return state

    # ── Step 2: Entity detection (cheap LLM call, ~20 tokens) ─────────
    state = await detect_entity_node(state)

    # ── Step 3: Fetch entity context (mandatory if entity found) ──────
    if state["detected_entity"]:
        state = await fetch_entity_context_node(state)

    # ── Step 4: Synthesize draft (Haiku for grounded, Groq fallback) ──
    state = await synthesize_draft_node(state)

    if state.get("error"):
        return state

    # ── Step 5: Verify syllabus against source (no LLM call) ──────────
    state = verify_syllabus_node(state)

    return state
