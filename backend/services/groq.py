import os
import json
import re
import logging
import asyncio
from typing import Optional
from dotenv import load_dotenv
from groq import AsyncGroq, APIError, RateLimitError, APIConnectionError
from services.search import search_internet

load_dotenv()

logger = logging.getLogger("edxiom.groq")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# ── Model routing: use the cheapest model that can handle each task ───
# Heavy (roadmaps, docs, MCQs): 70B for quality structured JSON output
# Light (entity detect, classification): 8B for speed + minimal tokens
import instructor
from schemas import ExamRoadmap

GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_MODEL_FAST = os.getenv("GROQ_MODEL_FAST", "openai/gpt-oss-20b")

_groq_client: Optional[AsyncGroq] = None
_instructor_client = None
_GROQ_SEMAPHORE = asyncio.Semaphore(10)


def get_groq_client() -> AsyncGroq:
    """Singleton getter for the Native AsyncGroq client."""
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        _groq_client = AsyncGroq(api_key=api_key)
    return _groq_client


def get_instructor_client():
    """Singleton getter for Instructor wrapped AsyncGroq client."""
    global _instructor_client
    if _instructor_client is None:
        raw_client = get_groq_client()
        _instructor_client = instructor.from_groq(raw_client, mode=instructor.Mode.JSON)
    return _instructor_client


async def generate_exam_roadmap_structured(
    goal_title: str,
    clean_context: str
) -> ExamRoadmap:
    """
    STRICT STEP 4 CONSTRAINT: Use heavy generator (llama-3.3-70b-versatile) ONLY for this
    final reasoning phase, feeding it clean context extracted by 8B model in Step 3.
    Returns validated ExamRoadmap Pydantic object.
    """
    async with _GROQ_SEMAPHORE:
        client = get_instructor_client()

        system_prompt = (
            "You are Edxiom AI, a high-accountability learning coach. "
            "Build a structured, exhaustive, subject-grounded learning roadmap based strictly on the provided clean context. "
            "Ensure modules have core topics and recommended video resources with satisfaction scores."
        )
        user_prompt = (
            f"Target Goal/Entity: {goal_title}\n\n"
            f"Verified Clean Context:\n{clean_context}\n\n"
            "Generate the complete ExamRoadmap structure:"
        )

        roadmap: ExamRoadmap = await client.chat.completions.create(
            model=GROQ_MODEL,
            response_model=ExamRoadmap,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_retries=3
        )

        return roadmap


async def call_groq(system_prompt: str, user_prompt: str, model: str = None,
                     temperature: float = 0.7, max_tokens: int = None) -> str:
    """Call Groq API via Native AsyncGroq SDK. Returns raw response string."""
    async with _GROQ_SEMAPHORE:
        use_model = model or GROQ_MODEL
        client = get_groq_client()

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        kwargs = {
            "model": use_model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens:
            kwargs["max_tokens"] = max_tokens

        for attempt in range(3):
            try:
                response = await client.chat.completions.create(**kwargs)
                return response.choices[0].message.content
            except RateLimitError as e:
                if attempt == 2:
                    logger.error(f"Rate limit exceeded ({use_model}): {e}")
                    raise
                await asyncio.sleep(1.5 * (attempt + 1))
            except APIConnectionError as e:
                if attempt == 2:
                    logger.error(f"Connection error ({use_model}): {e}")
                    raise
                await asyncio.sleep(1.0 * (attempt + 1))
            except APIError as e:
                logger.error(f"Groq API error ({use_model}): {e}")
                raise
            except Exception as e:
                logger.error(f"Unexpected error calling Groq ({use_model}): {e}")
                raise


async def call_groq_fast(system_prompt: str, user_prompt: str,
                          max_tokens: int = 30) -> str:
    """Lightweight Groq call using the 8B model for simple classification tasks.

    Saves tokens by using the smallest model with low temperature and capped output.
    Ideal for entity detection, yes/no questions, short extractions.
    """
    return await call_groq(
        system_prompt, user_prompt,
        model=GROQ_MODEL_FAST,
        temperature=0.1,
        max_tokens=max_tokens,
    )


async def extract_clean_context_fast(raw_data: str, target_entity: str = "") -> str:
    """
    STRICT STEP 3 CONSTRAINT: Use Groq fast classifier (llama-3.1-8b-instant) ONLY
    for retrieving, reading, and filtering raw HTML/web search data into a clean, 
    high-density text context. Do NOT use the 70B model here.
    """
    if not raw_data or not raw_data.strip():
        return "No search data found."

    system_prompt = (
        "You are Edxiom AI's fast text extraction engine. "
        "Filter and extract ONLY real syllabus topics, core modules, exam subtopics, and academic concepts. "
        "Strip out all web junk, navigation text, ads, and duplicate boilerplate. "
        "Return clean, high-density text bullet points."
    )
    user_prompt = (
        f"Target Entity/Exam: {target_entity}\n\n"
        f"Raw Web Search Data:\n{raw_data[:12000]}\n\n"
        "Extract concise, clean syllabus context:"
    )

    try:
        return await call_groq(
            system_prompt,
            user_prompt,
            model=GROQ_MODEL_FAST,
            temperature=0.1,
            max_tokens=800
        )
    except Exception as e:
        logger.warning(f"Fast 8B extraction failed, returning trimmed raw data: {e}")
        return raw_data[:3000]


# ── Grounded roadmap generation ────────────

GROUNDED_SYSTEM_PROMPT = (
    "You are Edxiom AI, a high-accountability learning coach. "
    "Generate an exhaustive, deep-dive learning roadmap as a JSON array. "
    "CRITICAL ROADMAP RULE: Focus strictly on core academic, practical, and subject-matter syllabus topics (e.g. core concepts, modules, theory, practice, hands-on skills). "
    "Do NOT include administrative meta-tasks or exam structural overview tasks like 'Understand Exam Pattern', 'Preliminary Examination', 'Mains Examination', 'Tips for Preparation', 'Resources' or 'Overview of Syllabus' as roadmap tasks. "
    "Every task and subtopic MUST be a teachable, practical, and testable subject concept. "
    "Each item has: title (task name), parts (array of subtopic strings). "
    "Return ONLY valid JSON, no markdown, no explanation. "
    "Generate 10-15 granular tasks, each with 5-8 detailed sub-parts."
)

GROUNDED_ENTITY_SYSTEM_PROMPT = (
    "You are Edxiom AI, a high-accountability learning coach. "
    "You will be given VERIFIED SOURCE MATERIAL about a specific exam/certification. "
    "Build the roadmap STRICTLY from the topics confirmed in the source material. "
    "Do NOT add topics from your general knowledge that aren't in the source. "
    "CRITICAL: Pay close attention to the EXACT exam paper/branch name. "
    "Many exams have multiple papers with different syllabi (e.g., GATE has 30+ papers: "
    "DA = Data Science and AI, AR = Architecture, CS = Computer Science, etc.). "
    "Match the roadmap to the SPECIFIC paper/branch mentioned in the user's goal. "
    "CRITICAL ROADMAP RULE: Focus strictly on core academic, practical, and subject-matter syllabus topics (e.g. core concepts, modules, theory, practice, hands-on skills). "
    "Do NOT include administrative meta-tasks or exam structural overview tasks like 'Understand Exam Pattern', 'Preliminary Examination', 'Mains Examination', 'Tips for Preparation', 'Resources' or 'Overview of Syllabus' as roadmap tasks. "
    "Every task and subtopic MUST be a teachable, practical, and testable subject concept. "
    "Generate an exhaustive learning roadmap as a JSON array. "
    "Each item has: title (task name), parts (array of subtopic strings). "
    "Return ONLY valid JSON, no markdown, no explanation. "
    "Generate 10-15 granular tasks, each with 5-8 detailed sub-parts."
)


async def generate_roadmap_grounded(
    goal_title: str,
    entity_context: str = None,
) -> list[dict]:
    """Generate a structured roadmap using the heavy Groq model.

    If entity_context is provided (from web search), the model is instructed
    to ONLY use verified source material to prevent hallucination.
    Uses the 70B model for best structured-output quality at $0 cost.
    """
    if entity_context:
        system = GROUNDED_ENTITY_SYSTEM_PROMPT
        user_prompt = (
            f"Goal: {goal_title}\n\n"
            f"Verified source material:\n{entity_context}"
        )
    else:
        system = GROUNDED_SYSTEM_PROMPT
        user_prompt = f"Create a detailed learning roadmap for core subject syllabus of: {goal_title}"

    raw = await call_groq(system, user_prompt, model=GROQ_MODEL)
    cleaned = _clean_json(raw)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error in grounded roadmap: {e}\nRaw: {raw[:500]}")
        raise ValueError(f"Failed to parse AI response as JSON: {e}")


def _clean_json(raw: str) -> str:
    """Extract the first valid JSON object from a potentially messy string."""
    import re
    cleaned = raw.strip()

    if cleaned.startswith("```"):
        # Remove first line (```json or ```)
        if "\n" in cleaned:
            cleaned = cleaned.split("\n", 1)[1]
        else:
            cleaned = cleaned[3:]
        # Remove trailing ```
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
    
    # Try to find a JSON object using regex if standard strip fails
    try:
        match = re.search(r'(\{.*\}|\[.*\])', cleaned, re.DOTALL)
        if match:
            cleaned = match.group(0)
    except Exception:
        pass

    # Fix unescaped newlines inside JSON string values.
    # This is the #1 cause of parse failures from LLMs.
    # Replace literal newlines that appear inside quoted strings with \n
    def _fix_newlines(s: str) -> str:
        result = []
        in_string = False
        escape = False
        for ch in s:
            if escape:
                result.append(ch)
                escape = False
                continue
            if ch == '\\':
                escape = True
                result.append(ch)
                continue
            if ch == '"':
                in_string = not in_string
                result.append(ch)
                continue
            if in_string and ch == '\n':
                result.append('\\n')
                continue
            if in_string and ch == '\r':
                continue  # strip carriage returns
            result.append(ch)
        return ''.join(result)

    cleaned = _fix_newlines(cleaned)
    return cleaned


async def generate_roadmap(goal_title: str) -> list[dict]:
    """Generate a structured roadmap from a goal title."""
    system_prompt = (
        "You are Edxiom AI, a high-accountability learning coach. "
        "Generate an exhaustive, deep-dive learning roadmap as a JSON array. "
        "CRITICAL ROADMAP RULE: Focus strictly on core academic, practical, and subject-matter syllabus topics. "
        "Do NOT include administrative meta-tasks like 'Understand Exam Pattern', 'Preliminary Examination', 'Mains Examination', 'Tips for Preparation', 'Resources' or 'Overview'. "
        "The roadmap must be comprehensive, covering every nuance of the subject syllabus in detail. "
        "Each item has: title (task name), parts (array of subtopic strings). "
        "Return ONLY valid JSON, no markdown, no explanation. "
        "Generate 10-15 granular tasks, each with 5-8 detailed sub-parts to ensure complete mastery."
    )
    user_prompt = f"Create a detailed learning roadmap for core subject syllabus of: {goal_title}"

    raw = await call_groq(system_prompt, user_prompt)
    cleaned = _clean_json(raw)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error in roadmap: {e}\nRaw: {raw[:500]}")
        raise ValueError(f"Failed to parse AI response as JSON: {e}")


# ── Keyword heuristic fallback for classify_parts_for_quiz ──────────────────
_NO_QUIZ_KEYWORDS = frozenset({
    "introduction", "intro", "overview", "history", "background", "about",
    "getting started", "prerequisites", "prerequisite", "setup", "install",
    "installation", "environment", "configuration", "what is", "why",
    "course outline", "syllabus", "guidelines", "strategy", "tips",
    "resources", "tools", "exam pattern", "pattern", "format", "schedule",
    "motivation", "roadmap", "plan", "approach", "summary", "revision plan",
})

def _keyword_requires_quiz(part_title: str) -> bool:
    """Fast O(1) heuristic: return False when the title clearly needs no quiz."""
    lower = part_title.lower()
    return not any(kw in lower for kw in _NO_QUIZ_KEYWORDS)


async def classify_parts_for_quiz(
    parts: list[str],
    task_title: str,
    goal_title: str,
) -> list[bool]:
    """
    Evaluate whether each part in a task warrants a multiple-choice quiz.

    Returns a list[bool] parallel to `parts`:
      - True  → technical / conceptual / syntactical / problem-solving topic → show quiz
      - False → history / setup / install / overview / meta-topic → skip quiz, use "Complete & Continue"

    Strategy: single batched LLM call on the fast/cheap model to classify all
    parts of a task in one shot. Falls back to keyword heuristic on failure.
    """
    if not parts:
        return []

    system_prompt = (
        "You are a curriculum classifier for an adaptive learning platform. "
        "Given a list of lesson titles from a learning module, decide whether each "
        "lesson warrants a multiple-choice knowledge quiz.\n\n"
        "RULES:\n"
        "- Return true  for: technical concepts, syntax, algorithms, data structures, "
        "  problem-solving, mathematical derivations, API usage, SQL queries, design patterns, "
        "  scientific principles, code writing, analytical topics.\n"
        "- Return false for: course introductions, history/origin stories, tool installation, "
        "  environment setup, prerequisite checklists, exam pattern overviews, tips & strategies, "
        "  motivational content, resource lists, roadmap summaries.\n\n"
        "Return ONLY a JSON array of booleans, one per input title, in the same order. "
        "No markdown, no explanation, no keys — just a bare JSON array like [true, false, true]."
    )

    numbered = "\n".join(f"{i+1}. {p}" for i, p in enumerate(parts))
    user_prompt = (
        f"Goal: {goal_title}\n"
        f"Module: {task_title}\n\n"
        f"Lessons to classify:\n{numbered}\n\n"
        "Return a JSON boolean array (same length as the list above):"
    )

    try:
        raw = await call_groq(
            system_prompt,
            user_prompt,
            model=GROQ_MODEL_FAST,   # cheap/fast model — classification only
            temperature=0.1,
            max_tokens=len(parts) * 10 + 20,  # tight token budget
        )
        cleaned = _clean_json(raw)
        result = json.loads(cleaned)

        if isinstance(result, list) and len(result) == len(parts):
            # Coerce to bool in case the model returns 0/1 integers
            return [bool(v) for v in result]

        logger.warning(
            f"classify_parts_for_quiz: unexpected result shape "
            f"(expected {len(parts)}, got {len(result)}). Falling back to heuristic."
        )
    except Exception as e:
        logger.warning(f"classify_parts_for_quiz LLM call failed ({e}). Using keyword heuristic.")

    # Keyword heuristic fallback
    return [_keyword_requires_quiz(p) for p in parts]


async def generate_mcqs(topic: str, count: int = 5, goal_title: str = None, task_title: str = None) -> list[dict]:
    """Generate MCQ questions for a topic, analyzing a YouTube video if present."""
    video_id = None
    if " || " in topic:
        clean_title, video_id = topic.split(" || ", 1)
        clean_title = clean_title.strip()
        video_id = video_id.strip()
    else:
        clean_title = topic.strip()

    transcript = None
    if video_id:
        try:
            from services.youtube import get_video_transcript
            transcript = await get_video_transcript(video_id)
        except Exception as e:
            logger.warning(f"Failed to fetch video transcript for MCQs: {e}")

    context_str = f"Target Goal: '{goal_title}', Module: '{task_title}'." if goal_title else ""

    if transcript:
        system_prompt = (
            f"You are Edxiom AI's quiz engine. {context_str} Generate exactly {count} multiple-choice questions "
            f"by analyzing the provided YouTube video transcript for the topic '{clean_title}'.\n"
            "Each question MUST test specific practical concepts, explanations, or details mentioned in the video transcript.\n"
            "Return ONLY a JSON array where each item has:\n"
            '"question" (string), "options" (array of 4 strings), "correct_index" (int 0-3).\n'
            "Questions should be challenging and test deep understanding of the video content.\n"
            "No markdown, no explanation, ONLY valid JSON."
        )
        user_prompt = f"Video Transcript:\n{transcript[:15000]}\n\nGenerate {count} MCQs based on the transcript."
    else:
        system_prompt = (
            f"You are Edxiom AI's quiz engine. {context_str} Generate exactly {count} multiple-choice questions "
            f"testing practical and core academic subject knowledge for the topic '{clean_title}'. "
            "Return ONLY a JSON array where each item has: "
            '"question" (string), "options" (array of 4 strings), "correct_index" (int 0-3). '
            "Questions should be challenging and test deep understanding of subject concepts. "
            "No markdown, no explanation, ONLY valid JSON."
        )
        user_prompt = f"Generate {count} challenging academic MCQs for topic '{clean_title}' in subject '{goal_title or clean_title}'"

    raw = await call_groq(system_prompt, user_prompt)
    cleaned = _clean_json(raw)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error in MCQs: {e}\nRaw: {raw[:500]}")
        raise ValueError(f"Failed to parse AI response as JSON: {e}")



def _normalize_draft_roadmap(roadmap):
    """Normalize draft_roadmap to always be a list of {title, parts} objects.
    
    The LLM sometimes returns flat strings like ["Topic A", "Topic B"]
    instead of the required [{"title": "Topic A", "parts": [...]}, ...].
    """
    if not roadmap or not isinstance(roadmap, list):
        return roadmap
    
    normalized = []
    for item in roadmap:
        if isinstance(item, str):
            # Flat string -> convert to object
            normalized.append({"title": item, "parts": []})
        elif isinstance(item, dict):
            # Ensure it has the required keys
            if "title" not in item:
                item["title"] = item.get("name", item.get("topic", "Untitled"))
            if "parts" not in item:
                # Check for alternative keys the LLM might use
                item["parts"] = item.get("subtopics", item.get("sub_topics", item.get("topics", [])))
            # Ensure parts is a list of strings
            if isinstance(item["parts"], list):
                item["parts"] = [
                    p if isinstance(p, str) else p.get("title", p.get("name", str(p)))
                    for p in item["parts"]
                ]
            normalized.append(item)
        else:
            normalized.append({"title": str(item), "parts": []})
    return normalized


async def generate_onboarding_response(messages: list[dict], goal_context: str = "No active goal.", session_type: str = "architect") -> dict:
    """Handle versatile Edxiom AI chat — general study Q&A + roadmap creation on demand."""
    import re
    from services.exam_resolver import resolve_exam
    from services.search import search_internet

    # Extract last user message to resolve any referenced exam entity & trigger auto search if needed
    exam_grounding_context = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            user_text = msg.get("content", "")
            
            # 1. Fuzzy Entity Resolver (Handles typos in exams & tech stacks e.g. "gate daa", "aws solutins")
            res = resolve_exam(user_text)
            if res.matched and res.entity:
                topics_str = ", ".join(res.entity.key_topics)
                exam_grounding_context = (
                    f"\n\n### VERIFIED EXAM / TOPIC SYLLABUS GROUNDING:\n"
                    f"Canonical Subject/Exam: {res.entity.canonical_name}\n"
                    f"Official Core Topics: {topics_str}\n"
                    f"CRITICAL: When discussing or generating the syllabus for {res.entity.canonical_name}, "
                    f"strictly use ONLY these topics ({topics_str}). Do not confuse with un-related exams!\n"
                )
                logger.info(f"🎯 Grounded chat with resolved entity: {res.entity.canonical_name}")
                break

            # 2. Universal Auto Web Search for syllabus/course/exam/subject queries
            # Always pre-fetch web search if user query relates to any subject, exam, or study topic
            text_lower = user_text.lower()
            should_search = (
                any(k in text_lower for k in ["syllabus", "topic", "exam", "course", "subject", "pattern", "prepare", "study", "gate", "cbse", "class", "sem"])
                or len(user_text.strip().split()) <= 5  # Short subject choices like "Probability and Statistics"
            )
            if should_search:
                # Find any parent exam mentioned in recent conversation
                parent_exam = ""
                for past_m in reversed(messages):
                    past_txt = past_m.get("content", "")
                    for kw in ["gate da", "gate cs", "gate", "cbse class 10", "cbse class 12", "class 10", "class 12", "jee mains", "neet", "cat", "aws", "btech"]:
                        if kw in past_txt.lower():
                            parent_exam = kw.upper()
                            break
                    if parent_exam:
                        break

                search_query = f"{parent_exam} {user_text} official detailed syllabus topics modules".strip()
                logger.info(f"🌐 Triggering automatic live web search pre-fetch: '{search_query}'")
                search_data = await search_internet(search_query, max_results=5)
                if search_data and "No relevant" not in search_data:
                    exam_grounding_context = (
                        f"\n\n### LIVE WEB SEARCH RESULTS (OFFICIAL GROUND TRUTH SYLLABUS):\n{search_data}\n"
                        f"CRITICAL: Use these search results to extract and display the FULL, COMPLETE, DETAILED syllabus topics below. Do NOT shorten or omit core sub-topics!\n"
                    )
                break

    if session_type == "assistant":
        system_prompt = (
            "You are Edxiom AI — a daily study companion and helpful tutor.\n"
            "Your main role is to help the user with daily tasks, explain concepts, answer questions, and act like ChatGPT.\n"
            "\n"
            f"### CURRENT CONTEXT:\n{goal_context}{exam_grounding_context}\n"
            "\n"
            "### BEHAVIOR RULES:\n"
            "- Be conversational, warm, and helpful.\n"
            "- Explain concepts clearly and concisely.\n"
            "- You can summarize text, translate, and analyze data if asked.\n"
            "\n"
            "### OUTPUT FORMAT:\n"
            "Return ONLY a single-line JSON object. Escape all newlines as \\\\n.\n"
            "Fields:\n"
            "- message: Your helpful response text.\n"
            "- phase: ALWAYS return 'chat'.\n"
            "- mood: Integer 1-5 (3=neutral).\n"
            "CRITICAL: NEVER generate roadmaps or try to move into discovery phases."
        )
    else:
        system_prompt = (
            "You are Edxiom AI — a strict, high-accountability study coach, mentor, and teacher. "
            "You are NOT a chatbot. You are a real teacher who helps students master ONE specific subject or skill at a time "
            "by researching and providing their FULL, ACCURATE official syllabus from real-world data.\n"
            "\n"
            f"### CURRENT CONTEXT:\n{goal_context}{exam_grounding_context}\n"
            "\n"
            "### MEMORY RULE (STRICT):\n"
            "- Persistent memory is SILENT background context for calculations only.\n"
            "- NEVER dump profile stats, degrees, or previous goals in your messages.\n"
            "- Speak naturally, warmly, like a real human mentor.\n"
        "\n"
        "### SINGLE-SUBJECT / SINGLE-SKILL POLICY (MANDATORY PRINCIPLE):\n"
        "To ensure study plans are easy to manage and schedule on a calendar timetable, every roadmap MUST focus on ONE specific subject or skill at a time.\n"
        "- If a user mentions a broad multi-subject exam or grade (e.g., 'CBSE Class 10', 'GATE DA 2026', 'B.Tech CSE 4th Sem', 'JEE Mains'), DO NOT create a multi-subject roadmap!\n"
        "- Instead, guide them warmly: 'To make your study plan clean, realistic, and easy to fit into your daily timetable, let's focus on ONE specific subject first! Which one would you like to start with? (For example: Mathematics, Science, Linear Algebra, Operating Systems, or Machine Learning?)'\n"
        "- Once the user picks a single subject/skill (e.g., 'CBSE Class 10 Maths' or 'GATE DA Linear Algebra'), fetch and build the roadmap ONLY for that specific subject.\n"
        "\n"
        "### DETAILED SYLLABUS PRESENTATION RULES (CRITICAL):\n"
        "When in `phase: 'discovery'` and presenting `### Syllabus & Topic Breakdown`:\n"
        "1. You MUST list the FULL, THOROUGH, COMPREHENSIVE topic list derived from the web search results.\n"
        "2. Do NOT write lazy 1-line or 2-line summaries! List at least 5 to 10 detailed bullet points covering all sub-modules, theorems, distributions, methods, and core concepts.\n"
        "3. Example format:\n"
        "   ### Syllabus & Topic Breakdown\n"
        "   * **Counting & Basic Probability**: Permutations, combinations, axioms of probability, sample space, events\n"
        "   * **Conditional & Independence**: Conditional probability, Bayes Theorem, independence of events, total probability\n"
        "   * **Random Variables & Distributions**: Discrete & continuous variables, PMF, PDF, CDF, expectation, variance\n"
        "   * **Standard Distributions**: Bernoulli, Binomial, Poisson, Uniform, Exponential, Normal/Gaussian distribution\n"
        "   * **Joint Distributions**: Joint PMF/PDF, marginal distributions, conditional expectation, covariance, correlation\n"
        "   * **Limit Theorems**: Law of large numbers, Central Limit Theorem (CLT)\n"
        "   * **Descriptive Statistics**: Mean, median, mode, variance, standard deviation, skewness, kurtosis\n"
        "   * **Inferential Statistics & Hypothesis Testing**: z-test, t-test, chi-square test, ANOVA, confidence intervals, p-values\n"
        "4. ALWAYS leave TWO empty lines before the final confirmation question so markdown list tags render properly!\n"
        "\n"
        "### PHASE STATE MACHINE — FOLLOW THIS EXACT STEP ORDER:\n"
        "1. **Phase: chat**\n"
        "   - Trigger: User says generic greetings ('hi', 'hello', 'help me') or vague statements.\n"
        "   - Action: Warmly ask which specific subject, skill, or exam they want to learn.\n"
        "   - Set phase: 'chat'. NEVER generate syllabus or draft_roadmap in chat phase.\n"
        "\n"
        "2. **Phase: discovery** (Subject Identified -> Display Syllabus & Ask User Approval)\n"
        "   - Trigger: User mentions a specific subject/skill/exam (e.g. 'i have to learn python', 'Python Data Structures', 'GATE DA', 'Docker').\n"
        "   - Action:\n"
        "     a. Display the FULL, THOROUGH official syllabus under `### Syllabus & Topic Breakdown` with 5-8 detailed bullet points.\n"
        "     b. End message with: 'Does this syllabus for [Subject/Skill Name] look good to you? Once confirmed, we will tailor your schedule preferences and build your master roadmap!'\n"
        "     c. Set phase: 'discovery'.\n"
        "     d. Extract target_exam in study_profile_update (e.g. {\"target_exam\": \"Python Data Structures\"}).\n"
        "     e. Set draft_roadmap: null.\n"
        "\n"
        "3. **Phase: syllabus_review** (User Approves Syllabus -> Display Schedule Preferences Form)\n"
        "   - Trigger: User confirms/approves the syllabus (e.g. 'yes', 'looks good', 'confirm', 'ok', 'correct', 'great', 'sure').\n"
        "   - Action:\n"
        "     a. Respond: 'Awesome! Let\\'s tailor your preparation roadmap schedule. Fill out your timeline and preference settings below, and I will synthesize your master learning path!'\n"
        "     b. Set phase: 'syllabus_review'.\n"
        "     c. Set draft_roadmap: null.\n"
        "\n"
        "4. **Phase: draft** (Schedule Submitted -> Generate Master Roadmap)\n"
        "   - Trigger: User submits schedule preferences form (contains timeline/hours like '6m', '2 hrs/day', 'Synthesize Master Roadmap').\n"
        "   - Action:\n"
        "     a. Set phase: 'draft'.\n"
        "     b. Set goal_title to the specific subject/skill name (e.g. 'Python Data Structures').\n"
        "     c. Provide a clean 10-12 module breakdown in `draft_roadmap`.\n"
        "\n"
        "5. **Phase: ready** — User confirms draft and starts.\n"
        "\n"
        "### ROADMAP STRUCTURE (SINGLE SUBJECT FOCUS):\n"
        "- Group the subject's syllabus into logical, chronological modules (e.g., Module 01: Real Numbers & Polynomials, Module 02: Linear Equations & Quadratic Equations, etc.).\n"
        "- Each task represents a focused topic block that easily translates to calendar study sessions.\n"
        "\n"
        "### WEB SEARCH TOOL:\n"
        "To search the internet: <edxiom_search>your search query</edxiom_search>\n"
        "ALWAYS search when a specific subject/skill is chosen to get current official syllabus.\n"
        "\n"
        "### DYNAMIC STUDY PROFILE EXTRACTION:\n"
        "For EVERY response, extract any user facts into study_profile_update:\n"
        "{\n"
        '  "target_exam": "CBSE Class 10 Mathematics / GATE DA Linear Algebra / etc",\n'
        '  "months_remaining": 6,\n'
        '  "preferred_language": "Hindi/Hinglish/English",\n'
        '  "preferred_youtubers": "Physics Wallah/Khan Academy/etc",\n'
        '  "study_hours_per_day": 2.0,\n'
        '  "learning_style": "From Scratch/Revision/etc"\n'
        "}\n"
        "\n"
        "### HOW TO BEHAVE:\n"
        "1. **One Subject at a Time**: Always encourage single-subject mastery. It keeps calendar planning simple, focused, and achievable.\n"
        "2. **Teacher First**: Always display the syllabus and wait for user approval before schedule tailoring.\n"
        "3. **Blunt & Caring**: Give realistic estimates for mastering the chosen subject.\n"
        "\n"
        "### OUTPUT FORMAT:\n"
        "Return ONLY a single-line JSON object. Escape all newlines as \\\\n.\n"
        "Fields:\n"
        "- message: Your response text. Natural, conversational, warm, and structured.\n"
        "- phase: EXACTLY one of: chat, discovery, syllabus_review, draft, ready\n"
        "- mood: Integer 1-5 (1=strict, 3=neutral, 5=praising)\n"
        "- draft_roadmap: ONLY when phase is 'draft' or 'ready'. Array: [{\"title\": \"...\", \"parts\": [\"...\", \"...\"]}].\n"
        "- goal_title: ONLY when phase is 'draft' or 'ready'.\n"
        "- study_profile_update: Always include if you extracted user facts.\n"
        "CRITICAL: The 'message' field MUST contain ONLY clean natural language text. NEVER dump raw JSON arrays, raw JSON objects, or headings like '### DRAFT ROADMAP' or '### STUDY PROFILE UPDATE' inside the 'message' string!\n"
        "CRITICAL: draft_roadmap MUST be null in chat, discovery, and syllabus_review phases.\n"
        "CRITICAL: Always narrow multi-subject requests down to ONE primary subject or skill."
    )
    current_messages = [{"role": "system", "content": system_prompt}] + messages
    client = get_groq_client()

    for attempt in range(3):  # Allow up to 2 search rounds
        try:
            # 1. Ask model via Native AsyncGroq SDK
            response = await client.chat.completions.create(
                model=GROQ_MODEL,
                messages=current_messages,
                temperature=0.7,
                max_tokens=4096,
            )
            raw_content = response.choices[0].message.content
            
            # 2. Check for manual search tag: <edxiom_search>query</edxiom_search>
            search_match = re.search(r'<edxiom_search>(.*?)</edxiom_search>', raw_content, re.IGNORECASE | re.DOTALL)
            
            if search_match:
                query = search_match.group(1).strip()
                logger.info(f"Manual Search Triggered: '{query}'")
                
                # Execute search
                results = await search_internet(query)
                
                # Add AI's "thought" and the results to history
                current_messages.append({"role": "assistant", "content": raw_content})
                current_messages.append({
                    "role": "user", 
                    "content": f"SEARCH_RESULTS for '{query}':\n\n{results}\n\nNow, please provide your response in the required JSON format."
                })
                
                # Continue loop to give results back to LLM
                continue
            else:
                # 3. No search? Clean and return JSON
                cleaned = _clean_json(raw_content)
                try:
                    result = json.loads(cleaned)
                except json.JSONDecodeError as e:
                    # If the AI ignored the JSON instruction and just answered in markdown, we can salvage it.
                    if not raw_content.strip().startswith("{"):
                        result = {
                            "message": raw_content,
                            "phase": "chat"
                        }
                    else:
                        logger.error(f"JSON Parse Error in onboarding chat (attempt {attempt+1}): {e}\nRaw Content: {raw_content[:500]}...")
                        if attempt == 2:
                            # Last attempt failed — return a safe fallback
                            return {
                                "message": "I've processed your request. Could you tell me more about what you'd like to focus on?",
                                "phase": "discovery",
                             }
                        current_messages.append({"role": "user", "content": "Error: Your response was not valid JSON. Please provide ONLY the JSON object with no literal newlines inside string values. Use \\n for line breaks."})
                        continue
                
                # Normalize draft_roadmap if present
                if "draft_roadmap" in result and result["draft_roadmap"]:
                    result["draft_roadmap"] = _normalize_draft_roadmap(result["draft_roadmap"])
                
                # Fix any double-escaped newlines that might have survived
                if "message" in result and isinstance(result["message"], str):
                    msg_text = result["message"].replace("\\n", "\n")
                    # Clean out any raw JSON dumps or draft headers hallucinated inside message string
                    msg_text = re.sub(r'###?\s*(DRAFT ROADMAP|GOAL TITLE|STUDY PROFILE UPDATE).*?(?=(###|\Z))', '', msg_text, flags=re.IGNORECASE | re.DOTALL)
                    msg_text = re.sub(r'\[\s*\{\s*"title".*?\}\s*\]', '', msg_text, flags=re.DOTALL)
                    msg_text = re.sub(r'\{\s*"(target_exam|months_remaining|study_hours_per_day|learning_style)".*?\}', '', msg_text, flags=re.DOTALL)
                    msg_text = re.sub(r'\{\s*"message"\s*:.*\}', '', msg_text, flags=re.DOTALL)
                    result["message"] = msg_text.strip()

                # Ensure required fields exist
                if "message" not in result or not result["message"]:
                    result["message"] = "Here is your customized learning plan."
                if "phase" not in result:
                    result["phase"] = "discovery"

                # Normalize unknown phases to known ones
                valid_phases = {"chat", "discovery", "syllabus_review", "draft", "ready"}
                if result.get("phase") not in valid_phases:
                    logger.warning(f"LLM returned unknown phase '{result.get('phase')}', defaulting to 'chat'")
                    result["phase"] = "chat"

                # PROGRAMMATIC GUARDRAIL: strictly enforce syllabus confirmation gate.
                msg_lower = result.get("message", "").lower()
                is_presenting_syllabus = "syllabus" in msg_lower or "topic breakdown" in msg_lower

                if is_presenting_syllabus and result.get("phase") != "draft":
                    result["phase"] = "discovery"
                    result["draft_roadmap"] = None
                    result["goal_title"] = None
                elif result.get("phase") in ["chat", "discovery", "syllabus_review"]:
                    result["draft_roadmap"] = None
                    result["goal_title"] = None

                # Log the roadmap type for observability
                if result.get("roadmap_type"):
                    logger.info(f"📐 Roadmap type: {result['roadmap_type']}")

                return result

        except RateLimitError as e:
            logger.warning(f"Groq Rate Limit on {GROQ_MODEL} (attempt {attempt+1}): {e}")
            if attempt == 2:
                # 🔄 Automatic fallback to 8B instant model (which has a separate 500,000 TPD quota)
                try:
                    logger.info(f"⚠️ 70B rate limit hit. Falling back to fast model ({GROQ_MODEL_FAST})...")
                    fallback_resp = await client.chat.completions.create(
                        model=GROQ_MODEL_FAST,
                        messages=current_messages,
                        temperature=0.7,
                        max_tokens=2048,
                    )
                    cleaned = _clean_json(fallback_resp.choices[0].message.content)
                    result = json.loads(cleaned)
                    if "message" in result and isinstance(result["message"], str):
                        msg_text = result["message"].replace("\\n", "\n")
                        msg_text = re.sub(r'###?\s*(DRAFT ROADMAP|GOAL TITLE|STUDY PROFILE UPDATE).*?(?=(###|\Z))', '', msg_text, flags=re.IGNORECASE | re.DOTALL)
                        msg_text = re.sub(r'\[\s*\{\s*"title".*?\}\s*\]', '', msg_text, flags=re.DOTALL)
                        msg_text = re.sub(r'\{\s*"(target_exam|months_remaining|study_hours_per_day|learning_style)".*?\}', '', msg_text, flags=re.DOTALL)
                        result["message"] = msg_text.strip()
                    if "message" not in result or not result["message"]:
                        result["message"] = "Here is your learning plan response."
                    if "phase" not in result:
                        result["phase"] = "discovery"
                    return result
                except Exception as fb_err:
                    logger.error(f"Fallback fast model also failed: {fb_err}")
                    raise e
            await asyncio.sleep(1.5)
        except APIError as e:
            logger.error(f"Groq API Error during onboarding (attempt {attempt+1}): {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in onboarding chat: {e}")
            raise

    raise ValueError("Failed to get valid response from AI after multiple attempts.")


async def generate_documentation(topic: str, research_data: str, transcript: str = None) -> str:
    """Generate a structured study guide for a topic using research data and optionally a YouTube transcript."""
    from services.math_utils import clean_latex_math

    system_prompt = (
        "You are Edxiom AI, a high-fidelity learning assistant. "
        "Your goal is to create a comprehensive, engaging, and structured study guide "
        "based on the provided raw research data and any provided video transcripts/content.\n\n"
        "### CRITICAL FORMATTING & LATEX MATH RULES:\n"
        "1. **STRICT MATH DELIMITERS**: ALL mathematical expressions, equations, variables, matrices, and symbols MUST use standard LaTeX math delimiters:\n"
        "   - Use `$ ... $` for inline variables and math expressions (e.g. `$m \\times n$`, `$p_i$`, `$i^{\\text{th}}$`, `$R_i \\leftrightarrow R_j$`, `$r = \\operatorname{rank}(A)$`, `$\\mathbf{x}_0$`, `$\\varnothing$`).\n"
        "   - Use `$$ ... $$` on dedicated lines for display/block equations and multi-line matrices.\n"
        "   - NEVER write LaTeX commands (like `\\operatorname`, `\\mathbf`, `\\qquad`, `\\begin{...}`) outside of `$ ... $` or `$$ ... $$`.\n"
        "   - NEVER wrap math in parentheses or brackets without dollar signs (e.g. NEVER write `(p_i)` or `(r = \\operatorname{rank}(A))` or `([A\\mid \\mathbf{b}])` - write `$p_i$`, `$r = \\operatorname{rank}(A)$`, `$[*A \\mid \\mathbf{b}*]$`).\n"
        "   - NEVER embed rogue dollar signs inside an unclosed math block.\n"
        "2. **NO RAW HTML**: NEVER output HTML tags like `<br>` or `<br/>`. Use standard Markdown line breaks.\n"
        "3. **MATRIX & MULTI-LINE EQUATIONS**: In environments like `cases`, `bmatrix`, `pmatrix`, `align`:\n"
        "   - ALWAYS double-escape backslashes for row separators so they yield `\\\\` (e.g., `a_1x_1 + b_1 = 0 \\\\ a_2x_2 + b_2 = 0`).\n"
        "4. **STRUCTURED LAYOUT**: Use Markdown headers (##, ###), tables, code blocks, and bold key terms.\n"
        "5. **TONE**: Intellectual, professional, yet accessible.\n\n"
        "Return ONLY the Markdown content, no conversational fillers."
    )

    if transcript:
        user_prompt = f"Topic: {topic}\n\nResearch Data:\n{research_data}\n\nYouTube Video Transcript:\n{transcript[:15000]}"
    else:
        user_prompt = f"Topic: {topic}\n\nResearch Data:\n{research_data}"

    raw_doc = await call_groq(system_prompt, user_prompt)
    return clean_latex_math(raw_doc)



def clean_youtube_title(title: str) -> str:
    """Clean raw YouTube video/playlist titles into clean, academic task/module names."""
    if not title or not isinstance(title, str):
        return "Learning Module"
    
    t = title.strip()
    
    # Remove unicode emojis and special icons
    t = re.sub(r'[\U00010000-\U0010ffff\u2600-\u27ff\u2300-\u23ff]', '', t)
    
    # Special brand goal title cleanup (only when title starts with the brand name)
    if re.search(r'^STRIVERS?\s*A2Z.*DSA', t, re.IGNORECASE) and len(t) < 65:
        return "Striver's A2Z Data Structures & Algorithms"
            
    # Remove creator / channel / playlist boilerplate extensions
    t = re.sub(r'\s*\|\s*(Strivers|Striver|A2Z|DSA|Playlist|Course|Placements|Lecture|Tutorial|Full Course|202\d).*$', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\s*-\s*(Strivers|Striver|A2Z|DSA|Course|L\d+|Placement).*$', '', t, flags=re.IGNORECASE)
    
    # Remove clickbait / informal phrases
    t = re.sub(r"(Don't watch my|Watch before|Must watch|Ka Baap|in \d+ Shot|Trick Explained|202\d)", '', t, flags=re.IGNORECASE)
    
    # Remove video index tags like "Re 4.", "Re 1.", "BS-7.", "BS-17.", "L9.", "L19.", "Lecture 1:"
    t = re.sub(r'^(Re\s*\d+[\.:\s]*|BS-\d+[\.:\s]*|L\d+[\.:\s]*|Lecture\s*\d+[\.:\s]*|Chapter\s*\d+[\.:\s]*)', '', t, flags=re.IGNORECASE)
    
    # Clean pipes, extra spaces, and dangling symbols
    t = re.sub(r'\s*\|\s*', ' - ', t)
    t = re.sub(r'-\s*-+', '-', t)
    t = re.sub(r'\s+', ' ', t).strip(' -:|')
    
    if not t or len(t) < 2:
        return "Core Concept Overview"
        
    return t


async def generate_roadmap_from_playlist(playlist_title: str, videos: list[dict]) -> dict:
    """Generate a structured chapter-based roadmap and a specific goal title from a list of YouTube video titles and IDs."""
    # Extract titles for LLM processing
    video_titles = [v["title"] for v in videos]
    
    # Format video titles with their indices for the LLM
    video_list_str = "\n".join([f"{idx}: {title}" for idx, title in enumerate(video_titles)])
    
    system_prompt = (
        "You are Edxiom AI, a high-accountability learning coach.\n"
        "I will provide you with a list of video titles from a YouTube playlist.\n"
        "Your goal is to:\n"
        "1. Synthesize a clean, professional, and academic Goal Title for the course (e.g., 'Data Structures & Algorithms' instead of raw playlist titles like 'STRIVERS A2Z-DSA COURSE | PLACEMENTS').\n"
        "2. Organize EVERY SINGLE ONE of these videos in chronological order into logical Modules.\n"
        "3. For each module, generate a clean, professional academic Module Name (e.g., 'Module 1: C++ Environment & Fundamentals', 'Module 2: Functional Recursion' - NEVER include clickbait or raw channel tags).\n"
        "4. For each video in a module, generate a clean, professional academic Module Task Name that describes what is taught in that video (RENAME and CLEAN UP all informal/creator titles like 'Arrays Ka Baap', 'Don't watch my A2Z DSA Course', '| Strivers A2Z DSA Course', 'in 1 Shot' into proper, professional academic subtopics like 'Arrays & Basic Operations' or 'Introduction to Recursion').\n"
        "\n"
        "Return ONLY a JSON object with this exact structure:\n"
        "{\n"
        '  "goal_title": "Clean Academic Goal Title",\n'
        '  "roadmap": [\n'
        "    {\n"
        '      "title": "Clean Academic Module Name 1",\n'
        '      "parts": [\n'
        '        {"title": "Clean Academic Task Title 1", "video_index": 0},\n'
        '        {"title": "Clean Academic Task Title 2", "video_index": 1}\n'
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Ensure every input video index from 0 to the last video index is assigned to exactly one part in ascending sequential order.\n"
        "No markdown, no explanation, ONLY valid JSON."
    )
    user_prompt = f"Playlist Title: {playlist_title}\n\nVideos:\n{video_list_str}\n\nGenerate the structured JSON roadmap."

    structured_roadmap = []
    goal_title = clean_youtube_title(playlist_title)
    
    try:
        raw = await call_groq(system_prompt, user_prompt)
        cleaned = _clean_json(raw)
        parsed = json.loads(cleaned)
        
        raw_gt = parsed.get("goal_title", playlist_title)
        goal_title = clean_youtube_title(raw_gt)
        parsed_chapters = parsed.get("roadmap", [])
        
        for chapter in parsed_chapters:
            raw_ch = chapter.get("title", f"Module {len(structured_roadmap) + 1}")
            chapter_title = clean_youtube_title(raw_ch)
            if not chapter_title.startswith("Module"):
                chapter_title = f"Module {len(structured_roadmap) + 1}: {chapter_title}"
                
            parts = []
            for part_item in chapter.get("parts", []):
                if isinstance(part_item, dict):
                    idx = part_item.get("video_index")
                    p_title = clean_youtube_title(part_item.get("title", "Untitled Part"))
                    if idx is not None and 0 <= idx < len(videos):
                        v = videos[idx]
                        parts.append(f"{p_title} || {v['video_id']}")
                elif isinstance(part_item, str):
                    parts.append(clean_youtube_title(part_item))
            if parts:
                structured_roadmap.append({
                    "title": chapter_title,
                    "parts": parts
                })
    except Exception as e:
        logger.error(f"Failed to generate playlist roadmap via LLM: {e}. Falling back to programmatic grouping.")
        structured_roadmap = []

    # If parsing failed or returned empty roadmap, run programmatic fallback
    if not structured_roadmap:
        chunk_size = 10
        goal_title = clean_youtube_title(playlist_title)
        for i in range(0, len(videos), chunk_size):
            chunk = videos[i:i+chunk_size]
            first_clean = clean_youtube_title(chunk[0]['title'])
            chapter_title = f"Module {i//chunk_size + 1}: {first_clean}"
            parts = [f"{clean_youtube_title(v['title'])} || {v['video_id']}" for v in chunk]
            structured_roadmap.append({
                "title": chapter_title,
                "parts": parts
            })

    normalized_roadmap = _normalize_draft_roadmap(structured_roadmap)
    return {
        "goal_title": goal_title,
        "roadmap": normalized_roadmap
    }

