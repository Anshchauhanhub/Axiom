"""
Vanilla Async Goal-Setting Agent — real-time entity-detection + verification pipeline.

Model routing (Native Groq SDK, $0 cost):
    - detect_entity → llama-3.1-8b-instant (fast, ~20 tokens, classification)
    - synthesize_draft → llama-3.3-70b-versatile (quality structured JSON)
    - intake, clarify, verify → rule-based (no LLM, $0)
    - resolve_best_creator → llama-3.1-8b-instant (fast, ~30 tokens, one-shot selection)

State machine engine (Vanilla Python Async):
    intake → clarify (if needed) → detect_entity → fetch_entity_context (if entity found)
    → synthesize_draft → verify_syllabus → resolve_best_creator → enrich_with_youtube → done
"""

import logging
import time
import re
from typing import TypedDict, Optional

logger = logging.getLogger("edxiom.goal_agent")


# ── Creator Registry ──────────────────────────────────────────────────
# Maps topic keywords → (canonical_creator_name, search_suffix)
# The search_suffix is appended to every YouTube query so ALL modules
# pull from the same creator's catalog.

_CREATOR_MAP: list[tuple[list[str], str, str]] = [
    # (keywords_to_match, creator_display_name, yt_search_suffix)
    (
        ["dsa", "data structure", "algorithm", "leetcode", "binary tree",
         "graph", "dynamic programming", "recursion", "backtracking",
         "linked list", "stack", "queue", "heap", "trie"],
        "Striver (takeUforward)",
        "Striver takeUforward",
    ),
    (
        ["gate cs", "gate computer science", "operating system", "dbms",
         "computer network", "toc", "theory of computation", "compiler design",
         "digital logic", "discrete mathematics", "computer organization"],
        "Gate Smashers",
        "Gate Smashers",
    ),
    (
        ["gate da", "data science", "machine learning", "deep learning",
         "neural network", "statistics", "probability", "linear algebra",
         "calculus", "optimization", "numpy", "pandas", "scikit"],
        "CampusX",
        "CampusX",
    ),
    (
        ["python", "django", "flask", "fastapi"],
        "CodeWithHarry",
        "CodeWithHarry",
    ),
    (
        ["javascript", "react", "node", "typescript", "vue", "angular",
         "web development", "html", "css", "full stack"],
        "Chai aur Code",
        "Chai aur Code",
    ),
    (
        ["java", "spring boot", "hibernate", "microservices"],
        "Telusko",
        "Telusko",
    ),
    (
        ["c++", "competitive programming", "cp"],
        "Luv",
        "Luv competitive programming",
    ),
    (
        ["system design", "low level design", "high level design", "lld", "hld"],
        "Gaurav Sen",
        "Gaurav Sen",
    ),
    (
        ["devops", "docker", "kubernetes", "aws", "azure", "gcp", "cloud",
         "terraform", "jenkins", "ci/cd"],
        "TechWorld with Nana",
        "TechWorld with Nana",
    ),
    (
        ["physics", "chemistry", "biology", "neet", "jee", "class 11", "class 12",
         "cbse", "12th", "11th"],
        "Physics Wallah",
        "Physics Wallah",
    ),
    (
        ["mathematics", "maths", "calculus", "algebra", "geometry",
         "trigonometry", "class 10", "class 9", "10th", "9th"],
        "Khan Academy",
        "Khan Academy",
    ),
    (
        ["upsc", "civil services", "ias", "ips", "general studies",
         "polity", "history", "geography", "economy"],
        "Unacademy UPSC",
        "Unacademy UPSC",
    ),
    (
        ["cat", "mba", "quantitative aptitude", "verbal ability",
         "logical reasoning", "dilr"],
        "2IIM CAT",
        "2IIM",
    ),
]


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
    selected_creator: Optional[str]       # e.g. "Striver takeUforward"
    selected_creator_name: Optional[str]  # e.g. "Striver (takeUforward)" (human-readable)
    # ── User preferences (from InteractiveDiscoveryCard / finalize form) ──
    preferred_language: Optional[str]     # "Hindi", "Hinglish", or "English"
    target_months: Optional[int]          # How many months user has
    daily_hours: Optional[float]          # Study hours per day
    playlist_url: Optional[str]           # User-provided YouTube playlist URL
    website_url: Optional[str]            # User-provided website/article URL
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
    Parse the raw goal for missing slots AND extract structured user preferences.
    Pure rule-based — no LLM call, $0 cost.
    """
    raw = state["raw_goal"]
    raw_lower = raw.lower()
    missing = []

    # ── Extract preferred language ────────────────────────────────────────
    lang = None
    if any(w in raw_lower for w in ["hindi", "in hindi", "\u0939\u093f\u0902\u0926\u0940"]):
        lang = "Hindi"
    elif any(w in raw_lower for w in ["hinglish", "hindi english"]):
        lang = "Hinglish"
    elif any(w in raw_lower for w in ["english", "in english"]):
        lang = "English"
    if lang and not state.get("preferred_language"):
        state["preferred_language"] = lang
        logger.info(f"🇨🇳 Detected preferred language: {lang}")

    # ── Extract target months ─────────────────────────────────────────────
    if not state.get("target_months"):
        m = re.search(r'(\d+)\s*month', raw_lower)
        if m:
            state["target_months"] = int(m.group(1))
        else:
            # Also check "X weeks" or "X days"
            wk = re.search(r'(\d+)\s*week', raw_lower)
            dy = re.search(r'(\d+)\s*day', raw_lower)
            if wk:
                state["target_months"] = max(1, round(int(wk.group(1)) / 4))
            elif dy:
                state["target_months"] = max(1, round(int(dy.group(1)) / 30))

    # ── Extract daily study hours ─────────────────────────────────────────
    if not state.get("daily_hours"):
        h = re.search(r'(\d+(?:\.\d+)?)\s*(?:hr|hour|hrs|hours?)\s*/\s*day', raw_lower)
        if h:
            state["daily_hours"] = float(h.group(1))

    # ── Check for missing critical slots ──────────────────────────────────
    has_timeline = bool(re.search(r'\d+\s*(day|week|month|hour)', raw_lower)) or \
                   any(w in raw_lower for w in ["deadline", "by ", "before ", "within "])
    if not has_timeline:
        missing.append("timeline")

    has_level = any(w in raw_lower for w in [
        "beginner", "intermediate", "advanced", "expert",
        "basics", "fundamentals", "zero", "scratch", "already know",
        "refresh", "deep dive", "mastery"
    ])
    if not has_level:
        missing.append("level")

    state["missing_slots"] = missing
    state["needs_clarification"] = len(missing) > 0
    state["conversation_turns"] = state.get("conversation_turns", 0)

    logger.info(
        f"Intake: missing_slots={missing}, lang={lang}, "
        f"months={state.get('target_months')}, hours={state.get('daily_hours')}"
    )
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


# ── Creator Resolution — pick ONE best creator for the entire goal ────

def _resolve_creator_from_registry(goal_text: str, entity: str) -> tuple[Optional[str], Optional[str]]:
    """
    Deterministically resolve the best single YouTube creator for a goal.
    Returns (yt_search_suffix, creator_display_name) or (None, None) if no match.
    Checks the registry in priority order — first match wins.
    """
    combined = f"{entity or ''} {goal_text}".lower()
    for keywords, display_name, search_suffix in _CREATOR_MAP:
        if any(kw in combined for kw in keywords):
            return search_suffix, display_name
    return None, None


async def resolve_best_creator_node(state: GoalState) -> GoalState:
    """
    ONE-SHOT creator selection that runs after syllabus verification.

    Strategy (priority order):
      1. Registry lookup — deterministic, $0 cost, <1ms
      2. LLM fallback (Groq 8B, ~15 tokens) — for niche/unknown goals
      3. Generic fallback — 'full course tutorial playlist'

    Language rule:
      If user selected Hindi or Hinglish, the language suffix is appended to
      the creator suffix so ALL YouTube searches are biased toward that language.
      The registry already maps many topics to Hindi-primary creators
      (CampusX, CodeWithHarry, Chai aur Code, Gate Smashers, Physics Wallah).
    """
    goal_text = state.get("clarified_goal") or state["raw_goal"]
    entity = state.get("detected_entity", "") or ""
    lang = state.get("preferred_language") or "English"

    # Step 1: Registry lookup (deterministic)
    suffix, display_name = _resolve_creator_from_registry(goal_text, entity)
    if suffix:
        # Append language hint if Hindi/Hinglish — biases YouTube search toward
        # that creator's Hindi-medium content without breaking the creator filter.
        if lang in ("Hindi", "Hinglish"):
            lang_tag = "Hindi" if lang == "Hindi" else "Hinglish"
            suffix = f"{suffix} {lang_tag}"
            logger.info(f"🇨🇳 Language suffix added: '{lang_tag}'")
        state["selected_creator"] = suffix
        state["selected_creator_name"] = display_name
        logger.info(f"🎨 Creator resolved (registry): {display_name} → suffix='{suffix}'")
        return state

    # Step 2: LLM fallback for niche goals (Groq 8B, ~15 tokens)
    try:
        from services.groq import call_groq_fast
        lang_note = f" Prefer a {lang}-medium channel." if lang in ("Hindi", "Hinglish") else ""
        lm_prompt = (
            f"You are a YouTube educator recommender.\n"
            f"A student wants to learn: '{goal_text}'.{lang_note}\n"
            f"Pick EXACTLY ONE well-known YouTube channel or educator that has the BEST "
            f"complete playlist/course for this topic.\n"
            f"Examples: 'MIT OpenCourseWare', 'freeCodeCamp', 'Fireship', "
            f"'Sentdex', 'StatQuest with Josh Starmer', 'Corey Schafer', '3Blue1Brown'.\n"
            f"Respond with ONLY the channel name, nothing else."
        )
        raw = await call_groq_fast(
            system_prompt="You are a YouTube channel recommender. Respond with only a channel name.",
            user_prompt=lm_prompt,
            max_tokens=15,
        )
        creator_name = raw.strip().strip('"').strip("'").strip()
        if creator_name and len(creator_name) > 2:
            final_suffix = f"{creator_name} {lang}" if lang in ("Hindi", "Hinglish") else creator_name
            state["selected_creator"] = final_suffix
            state["selected_creator_name"] = creator_name
            logger.info(f"🤖 Creator resolved (LLM 8B): '{creator_name}' lang={lang}")
            return state
    except Exception as e:
        logger.warning(f"LLM creator resolution failed (non-fatal): {e}")

    # Step 3: Generic fallback
    lang_suffix = f" {lang}" if lang in ("Hindi", "Hinglish") else ""
    state["selected_creator"] = f"full course tutorial playlist{lang_suffix}"
    state["selected_creator_name"] = None
    logger.info(f"🔖 Creator resolved (generic fallback, lang={lang})")
    return state


# ── YouTube Video Enrichment — attach best videos to each part ────────

async def enrich_with_youtube_node(state: GoalState) -> GoalState:
    """
    After the roadmap is generated, search YouTube for the best tutorial
    video for each task module — ALL from the SAME creator selected by
    resolve_best_creator_node, with channel-name verification in every
    search layer (via creator_hint param passed to search_youtube_video_id).

    Uses the ' || video_id' convention so synthesis.py can embed the video.
    Limits to Semaphore(2) for Render memory safety.
    """
    from services.youtube import search_youtube_video_id  # direct import for creator_hint support
    import asyncio
    import gc

    syllabus = state.get("verified_syllabus") or state.get("draft_syllabus")
    if not syllabus:
        return state

    entity = state.get("detected_entity", "") or ""
    creator_suffix = state.get("selected_creator") or "full course tutorial"
    creator_name = state.get("selected_creator_name") or creator_suffix
    logger.info(f"🎬 YouTube enrichment — creator locked to: '{creator_name}' suffix='{creator_suffix}'")

    semaphore = asyncio.Semaphore(2)

    async def find_video_for_task(task: dict) -> dict:
        async with semaphore:
            title = task.get("title", "")
            # Scoped query: entity + module topic + creator suffix (language already baked in)
            if entity:
                search_query = f"{entity} {title} {creator_suffix}"
            else:
                search_query = f"{title} {creator_suffix}"

            try:
                # Pass creator_suffix as creator_hint — YouTube layers will verify channel name
                video_id = await search_youtube_video_id(
                    query=search_query,
                    creator_hint=creator_suffix,
                )
                if video_id:
                    parts = task.get("parts", [])
                    if parts and isinstance(parts[0], str) and " || " not in parts[0]:
                        parts[0] = f"{parts[0]} || {video_id}"
                        task["parts"] = parts
                        logger.debug(
                            f"✅ Attached {video_id} to '{title}' (creator: {creator_name})"
                        )
            except Exception as e:
                logger.warning(f"YouTube enrichment failed for '{title}': {e}")

            return task

    try:
        tasks_to_enrich = syllabus[:8]
        remaining_tasks = syllabus[8:]

        enriched_tasks = await asyncio.gather(
            *[find_video_for_task(task) for task in tasks_to_enrich],
            return_exceptions=True,
        )

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
            logger.info(
                f"🎬 Enrichment complete: {video_count} videos from '{creator_name}'"
            )
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
    preferred_language: Optional[str] = None,
    target_months: Optional[int] = None,
    daily_hours: Optional[float] = None,
    playlist_url: Optional[str] = None,
    website_url: Optional[str] = None,
) -> GoalState:
    """
    Run the high-performance Vanilla Async Goal-Setting Agent Pipeline.

    Pipeline: intake → clarify? → detect_entity → fetch_entity_context? → synthesize_draft → verify → resolve_creator → enrich_youtube

    User preferences (preferred_language, target_months, daily_hours, playlist_url, website_url)
    are injected into state at startup so every node can read them.

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
        "selected_creator": None,
        "selected_creator_name": None,
        # Inject caller-provided preferences (override what intake_node parses)
        "preferred_language": preferred_language,
        "target_months": target_months,
        "daily_hours": daily_hours,
        "playlist_url": playlist_url,
        "website_url": website_url,
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

    # ── Step 6: Resolve single best YouTube creator for the goal ──────
    state = await resolve_best_creator_node(state)

    # ── Step 7: Enrich all modules with videos from that ONE creator ──
    state = await enrich_with_youtube_node(state)

    state["execution_time_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
    logger.info(
        f"⚡ Goal agent pipeline completed in {state['execution_time_ms']}ms "
        f"(creator: {state.get('selected_creator_name') or 'generic'})"
    )

    return state
