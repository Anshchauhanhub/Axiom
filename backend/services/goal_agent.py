"""
Vanilla Async Goal-Setting Agent — real-time entity-detection + verification pipeline.

Model routing (Native Groq SDK, $0 cost):
    - detect_entity → llama-3.1-8b-instant (fast, ~20 tokens, classification)
    - synthesize_draft → llama-3.3-70b-versatile (quality structured JSON)
    - intake, clarify, verify → rule-based (no LLM, $0)

State machine engine (Vanilla Python Async):
    intake → clarify (if needed) → detect_entity → fetch_entity_context (if entity found)
    → synthesize_draft → verify_syllabus → enrich_with_youtube → done
"""

import logging
import time
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
    execution_time_ms: float
    error: Optional[str]


# ── Entity detection prompt ───────────────────────────────────────────

ENTITY_DETECT_PROMPT = """Does this learning goal reference a specific named exam, \
certification, syllabus, or curriculum?

Examples of entities:
- "GATE DA" → "GATE DA Data Science and Artificial Intelligence"
- "GATE CS" → "GATE CS Computer Science and Information Technology"
- "CAT" → "CAT Common Admission Test"
- "JEE Advanced" → "JEE Advanced"
- "UPSC CSE" → "UPSC Civil Services Examination"
- "AWS SAA-C03" → "AWS Solutions Architect Associate SAA-C03"

Rules:
- If yes, return the entity name WITH its full expanded form (as shown above) so web search finds the right syllabus.
- If the goal is generic ("learn Python", "get better at DSA") with no named exam, return "NONE".
- For multi-branch exams like GATE, ALWAYS include the specific branch/paper code AND its full name.

Goal: "{goal}"

Respond with only the entity name (expanded) or NONE, nothing else."""


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


# ── Entity Detection (Groq 8B — fast, cheap, ~20 tokens) ─────────────
# ── Entity Detection & Resolution ────────────────────────────────────

async def detect_entity_node(state: GoalState) -> GoalState:
    """
    Deterministically resolve user input to a canonical exam if possible.
    If ambiguous, trigger clarification. If generic, fall back to LLM.
    """
    from services.exam_resolver import resolve_exam

    goal = state.get("clarified_goal") or state["raw_goal"]

    # Try resolving deterministically first
    res = resolve_exam(goal)
    if res.matched and res.entity:
        state["detected_entity"] = res.entity.canonical_name
        logger.info(f"🎯 Deterministic exam match: {res.entity.canonical_name}")
        return state

    if not res.matched and res.candidates:
        # Ask for clarification if a candidate has reasonably high score (> 50)
        if res.confidence >= 50.0:
            state["needs_clarification"] = True
            state["clarification_question"] = (
                f"Did you mean one of these exams?\n" + 
                "\n".join(f"- {c[0]}" for c in res.candidates[:3])
            )
            state["missing_slots"] = ["exam_clarification"]
            logger.info(f"❓ Ambiguous exam matched, requesting clarification: {res.candidates}")
            return state

    # Fall back to LLM to detect if there's any other named exam we don't have in the registry
    from services.groq import call_groq_fast
    try:
        response = await call_groq_fast(
            system_prompt="You are a classification assistant. Respond with ONLY the entity name or NONE.",
            user_prompt=ENTITY_DETECT_PROMPT.format(goal=goal),
            max_tokens=20,
        )
        entity = response.strip().strip('"').strip("'")
        state["detected_entity"] = None if entity.upper() == "NONE" else entity
        logger.info(f"🔍 Entity detection fallback (Groq 8B): '{goal[:60]}...' → {state['detected_entity'] or 'NONE'}")
    except Exception as e:
        logger.warning(f"Entity detection fallback failed (non-fatal): {e}")
        state["detected_entity"] = None

    return state


# ── Mandatory search for detected entities ────────────────────────────

async def fetch_entity_context_node(state: GoalState) -> GoalState:
    """
    If an entity was detected, run a DEEP multi-query search for its official syllabus.
    Uses Groq 8B (llama-3.1-8b-instant) strictly to filter raw HTML/web search data into a clean context.
    """
    from services.search import search_entity_deep
    from services.exam_resolver import EXAM_REGISTRY, verify_grounding
    from services.groq import extract_clean_context_fast

    entity = state["detected_entity"]
    logger.info(f"🌐 Deep-searching entity context via SearXNG for: '{entity}'")
    
    raw_results = await search_entity_deep(entity)
    
    # Verify grounding if matched in registry
    matched_entity = next((e for e in EXAM_REGISTRY if e.canonical_name == entity), None) if entity else None
    if matched_entity and raw_results:
        passed = verify_grounding(matched_entity, raw_results)
        if not passed:
            logger.warning("⚠️ First search grounding verification failed. Retrying with broad query...")
            broad_query = f"{matched_entity.canonical_name} official syllabus exam topics"
            from services.search import search_internet
            raw_results = await search_internet(broad_query, max_results=6)
            passed = verify_grounding(matched_entity, raw_results)
            state["verification_passed"] = passed
        else:
            state["verification_passed"] = True
    else:
        state["verification_passed"] = True

    # STRICT STEP 3: Filter raw search data into clean text context using Groq 8B fast classifier ONLY
    clean_context = await extract_clean_context_fast(raw_results, target_entity=entity or state["raw_goal"])
    state["realtime_context"] = clean_context
    return state


# ── Draft generation — Instructor + Pydantic (Groq 70B) ─────────

async def synthesize_draft_node(state: GoalState) -> GoalState:
    """
    STRICT STEP 4: Build the structured ExamRoadmap using Groq 70B (llama-3.3-70b-versatile) wrapped in Instructor.
    Passes clean context extracted by 8B model in Step 3.
    """
    from services.groq import generate_exam_roadmap_structured, generate_roadmap_grounded
    from schemas.pydantic_schemas import ExamRoadmap

    goal_text = state.get("clarified_goal") or state["raw_goal"]
    context = state.get("realtime_context", "") or ""

    try:
        exam_roadmap: ExamRoadmap = await generate_exam_roadmap_structured(
            goal_title=goal_text,
            clean_context=context
        )
        
        # Convert ExamRoadmap Pydantic object into task/part dictionary array for full compatibility
        syllabus = []
        for mod in exam_roadmap.modules:
            syllabus.append({
                "title": mod.module_title,
                "parts": mod.core_topics
            })

        state["draft_syllabus"] = syllabus
        state["error"] = None
        logger.info(f"✅ Bulletproof ExamRoadmap synthesized (Instructor + Groq 70B): {len(syllabus)} modules")
    except Exception as e:
        logger.warning(f"Instructor Pydantic roadmap generation failed ({e}), falling back to grounded JSON generator.")
        try:
            syllabus = await generate_roadmap_grounded(
                goal_title=goal_text,
                entity_context=context,
            )
            state["draft_syllabus"] = syllabus
            state["error"] = None
        except Exception as fallback_err:
            state["error"] = str(fallback_err)
            logger.error(f"❌ Draft synthesis failed: {fallback_err}")

    return state


# ── YouTube Video Enrichment — attach best videos to each part ────────

async def enrich_with_youtube_node(state: GoalState) -> GoalState:
    """
    After the roadmap is generated, search YouTube for the best tutorial
    video for each task module. Appends video_id to part titles using
    the ' || video_id' convention that synthesis.py already understands.
    
    Searches in parallel for speed. Uses the 8B model to pick the best
    video per module (costs ~10 tokens each).
    """
    from services.search import search_youtube_videos
    import asyncio
    import gc

    syllabus = state.get("verified_syllabus") or state.get("draft_syllabus")
    if not syllabus:
        return state

    goal_text = state.get("clarified_goal") or state["raw_goal"]
    entity = state.get("detected_entity", "")

    # Restrict concurrent searches to 2 max to save memory on Render
    semaphore = asyncio.Semaphore(2)

    # Search YouTube for each task module
    async def find_videos_for_task(task: dict) -> dict:
        async with semaphore:
            title = task.get("title", "")
            search_query = f"{title} {entity} tutorial" if entity else f"{title} tutorial"
            
            try:
                videos = await search_youtube_videos(search_query, max_results=1)
                if videos:
                    video_id = videos[0]["video_id"]
                    # Attach video to the first part of this task
                    parts = task.get("parts", [])
                    if parts and isinstance(parts[0], str) and " || " not in parts[0]:
                        parts[0] = f"{parts[0]} || {video_id}"
                        task["parts"] = parts
            except Exception as e:
                logger.warning(f"YouTube enrichment failed for '{title}': {e}")
            
            return task

    try:
        # Limit enrichment to top 8 task modules max
        tasks_to_enrich = syllabus[:8]
        remaining_tasks = syllabus[8:]

        enriched_tasks = await asyncio.gather(
            *[find_videos_for_task(task) for task in tasks_to_enrich],
            return_exceptions=True,
        )
        
        # Filter out exceptions, keep successfully enriched tasks
        final_syllabus = []
        for result in enriched_tasks:
            if isinstance(result, Exception):
                logger.warning(f"YouTube enrichment error: {result}")
            elif isinstance(result, dict):
                final_syllabus.append(result)
        
        final_syllabus.extend(remaining_tasks)
        
        if final_syllabus:
            state["verified_syllabus"] = final_syllabus
            video_count = sum(
                1 for t in final_syllabus 
                for p in t.get("parts", []) 
                if isinstance(p, str) and " || " in p
            )
            logger.info(f"🎬 YouTube enrichment complete: {video_count} videos attached")
    except Exception as e:
        logger.warning(f"YouTube enrichment failed (non-fatal): {e}")
    finally:
        gc.collect()

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
    Run the high-performance Vanilla Async Goal-Setting Agent Pipeline.

    Pipeline: intake → clarify? → detect_entity → fetch_entity_context? → synthesize_draft → verify → enrich_youtube

    If `clarification_reply` is None, this is the first invocation.
    If provided, this is a follow-up after the user answered a clarification question.

    Returns the final GoalState. Check:
      - state["needs_clarification"]: True → return clarification_question to user, wait for reply
      - state["verified_syllabus"]: not None → roadmap is ready
      - state["error"]: not None → something went wrong
    """
    start_time = time.perf_counter()
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
        "execution_time_ms": 0.0,
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
            state["execution_time_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
            return state

    # ── Step 2: Entity detection (Groq 8B Native SDK) ────────────────
    state = await detect_entity_node(state)

    # ── Step 3: Fetch entity context (mandatory if entity found) ──────
    if state["detected_entity"]:
        state = await fetch_entity_context_node(state)

    # ── Step 4: Synthesize draft (Groq 70B Native SDK) ───────────────
    state = await synthesize_draft_node(state)

    if state.get("error"):
        state["execution_time_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
        return state

    # ── Step 5: Verify syllabus against source (no LLM call) ──────────
    state = verify_syllabus_node(state)

    # ── Step 6: Enrich with YouTube videos (parallel search) ──────────
    state = await enrich_with_youtube_node(state)

    state["execution_time_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
    logger.info(f"⚡ Goal agent pipeline completed in {state['execution_time_ms']}ms")

    return state
