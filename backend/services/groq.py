import os
import json
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
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_MODEL_FAST = os.getenv("GROQ_MODEL_FAST", "llama-3.1-8b-instant")

_groq_client: Optional[AsyncGroq] = None

def get_groq_client() -> AsyncGroq:
    """Singleton getter for the Native AsyncGroq client."""
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        _groq_client = AsyncGroq(api_key=api_key)
    return _groq_client


async def call_groq(system_prompt: str, user_prompt: str, model: str = None,
                     temperature: float = 0.7, max_tokens: int = None) -> str:
    """Call Groq API via Native AsyncGroq SDK. Returns raw response string.

    Args:
        model: Override default model. Use GROQ_MODEL_FAST for fast/cheap tasks.
        temperature: Lower = more deterministic (good for classification).
        max_tokens: Cap output length to save tokens.
    """
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


# ── Grounded roadmap generation (replaces Anthropic Haiku) ────────────

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
    "CRITICAL: Pay close attention to the EXACT exam paper/branch name. "
    "Many exams have multiple papers with different syllabi (e.g., GATE has 30+ papers: "
    "DA = Data Science and AI, AR = Architecture, CS = Computer Science, etc.). "
    "Match the roadmap to the SPECIFIC paper/branch mentioned in the user's goal. "
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
        user_prompt = f"Create a detailed learning roadmap for: {goal_title}"

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
        "The roadmap must be comprehensive, covering every nuance of the syllabus in detail. "
        "Each item has: title (task name), parts (array of subtopic strings). "
        "Return ONLY valid JSON, no markdown, no explanation. "
        "Generate 10-15 granular tasks, each with 5-8 detailed sub-parts to ensure complete mastery."
    )
    user_prompt = f"Create a detailed learning roadmap for: {goal_title}"

    raw = await call_groq(system_prompt, user_prompt)
    cleaned = _clean_json(raw)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error in roadmap: {e}\nRaw: {raw[:500]}")
        raise ValueError(f"Failed to parse AI response as JSON: {e}")


async def generate_mcqs(topic: str, count: int = 5) -> list[dict]:
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

    if transcript:
        system_prompt = (
            f"You are Edxiom AI's quiz engine. Generate exactly {count} multiple-choice questions "
            f"by analyzing the provided YouTube video transcript for the topic '{clean_title}'.\n"
            "Each question MUST test specific concepts, explanations, or details mentioned in the video transcript.\n"
            "Return ONLY a JSON array where each item has:\n"
            '"question" (string), "options" (array of 4 strings), "correct_index" (int 0-3).\n'
            "Questions should be challenging and test deep understanding of the video content.\n"
            "No markdown, no explanation, ONLY valid JSON."
        )
        user_prompt = f"Video Transcript:\n{transcript[:15000]}\n\nGenerate {count} MCQs based on the transcript."
    else:
        system_prompt = (
            f"You are Edxiom AI's quiz engine. Generate exactly {count} multiple-choice questions. "
            "Return ONLY a JSON array where each item has: "
            '"question" (string), "options" (array of 4 strings), "correct_index" (int 0-3). '
            "Questions should be challenging and test deep understanding. "
            "No markdown, no explanation, ONLY valid JSON."
        )
        user_prompt = f"Generate {count} challenging MCQs about: {clean_title}"

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


async def generate_onboarding_response(messages: list[dict], goal_context: str = "No active goal.") -> dict:
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

            # 2. Universal Auto Web Search for syllabus/course/exam queries
            text_lower = user_text.lower()
            if any(k in text_lower for k in ["syllabus", "topic", "exam", "course", "subject", "pattern", "prepare", "study"]):
                logger.info(f"🌐 Triggering automatic live web search pre-fetch for user query: '{user_text}'")
                search_query = f"{user_text} official syllabus latest topics"
                search_data = await search_internet(search_query, max_results=3)
                if search_data and "No relevant" not in search_data:
                    exam_grounding_context = (
                        f"\n\n### LIVE WEB SEARCH RESULTS (GROUND TRUTH):\n{search_data}\n"
                    )
                break

    system_prompt = (
        "You are Edxiom AI, a strict, high-accountability AI study coach, human mentor, and teacher substitute. "
        "You answer questions clearly, thoroughly, and act as a blunt, caring friend who wants the user to succeed.\n"
        "\n"
        f"### CURRENT CONTEXT:\n{goal_context}{exam_grounding_context}\n"
        "\n"
        "### NATURAL GREETING & MEMORY RULE (STRICT):\n"
        "- DO NOT list, summarize, recite, or state the user's persistent profile facts (e.g. NEVER say 'I see you are a 4th-year student with 7 months left...', readiness score %, hours allocated, or previous goals) in your greeting or response!\n"
        "- Persistent memory is SILENT background context for your calculations only. Never dump it to the user.\n"
        "- Speak naturally, conversationally, and warmly like a real human mentor. When starting a chat or receiving greetings like 'hi' or 'hello', reply simply and naturally, e.g.: 'Hey! How are you doing today? What would you like to work on or learn next?'\n"
        "\n"
        "### INTERACTIVE 3-STEP DISCOVERY PROTOCOL:\n"
        "1. **Step 1 (Goal & Syllabus Discussion)**: When user mentions a target goal/exam/skill, fetch/discuss the latest official syllabus over the internet. Discuss key topics warmly and naturally.\n"
        "2. **Step 2 (User Preferences & Fact Extraction)**: Ask clarifying questions one or two at a time:\n"
        "   - Total months / timeline available to achieve this goal.\n"
        "   - Preferred video/teaching language (e.g. Hindi, Hinglish, English).\n"
        "   - Favorite YouTubers, channels, or websites (or if they are starting from complete scratch).\n"
        "   - Daily available study hours.\n"
        "3. **Step 3 (Web-Derived & YouTube Playlist Synthesis)**: Synthesize real-world top-rated roadmaps and YouTube playlists matching their preferred language and creators into a master `draft_roadmap` (Array of modules with parts).\n"
        "\n"
        "### STRUCTURED UI DIALOGUE CARD FORMAT (STRICT):\n"
        "NEVER dump your response as a wall of text or list text questions!\n"
        "Always structure your messages into clear sections:\n"
        "- Start with 1 brief encouraging intro sentence.\n"
        "- Use `### Syllabus & Topic Breakdown` to list core syllabus subjects using bold bullet points (`* **Topic**: description`).\n"
        "- DO NOT write or list text questions in your response message! The UI has an interactive form widget for user inputs. End your message with a brief friendly note: 'Please complete the Interactive Preference Form below to choose your timeline, preferred teaching language, playlist, and study materials!'\n"
        "\n"
        "### DYNAMIC DRAFT BOX FACTS EXTRACTION:\n"
        "For EVERY response, listen carefully and extract any available user facts in the `study_profile_update` field:\n"
        "{\n"
        '  "target_exam": "GATE DA 2026/etc",\n'
        '  "months_remaining": 6,\n'
        '  "preferred_language": "Hindi/Hinglish/English",\n'
        '  "preferred_youtubers": "Physics Wallah/Gate Smashers/CodeWithHarry/etc",\n'
        '  "study_hours_per_day": 2.0,\n'
        '  "learning_style": "From Scratch/Revision/etc"\n'
        "}\n"
        "\n"
        "### HOW TO BEHAVE:\n"
        "1. **Tough-Love Mentor & Realistic Estimator**: Be a real friend/mentor. If the user tells you they want to crack a major exam in 2 months with 1 hr/day, calculate total hours (60 hrs vs 300+ needed), estimate pass probability, and tell them bluntly to increase daily hours!\n"
        "2. **Give DETAILED answers**: When user asks a question (phase=chat), provide a THOROUGH, comprehensive explanation with headings and bullet points.\n"
        "3. **ALWAYS SEARCH for exams/certifications**: If user mentions any named exam, certification, or skill, use <edxiom_search>query</edxiom_search> to get current real-world syllabi before generating roadmaps.\n"
        "4. **Roadmap creation flow**:\n"
        "   - discovery: Discuss syllabus and gather preferences (language, months, YouTubers, hours).\n"
        "   - draft/ready: When user provides preferences (or submits their timeline/language choices), IMMEDIATELY generate a master web-derived roadmap tailored to their timeline and language in the `draft_roadmap` JSON field, and set `phase: 'draft'`.\n"
        "\n"
        "### WEB SEARCH TOOL:\n"
        "To search the internet for current information, embed this tag in your response:\n"
        "<edxiom_search>your search query</edxiom_search>\n"
        "\n"
        "### OUTPUT FORMAT:\n"
        "Return ONLY a single-line JSON object. Escape all newlines as \\\\n.\n"
        "Fields:\n"
        "- message: Your response text. Keep it interactive, natural, and conversational.\n"
        "- phase: One of chat, discovery, draft, ready\n"
        "- mood: Integer from 1 to 5 based on user progress/readiness (1=angry/strict, 3=neutral, 5=happy/praising).\n"
        "- draft_roadmap: Include ONLY when phase is draft or ready. Array of objects: "
        '[{"title": "Task Name", "parts": ["sub1", "sub2"]}].\n'
        "- goal_title: Include ONLY when phase is draft or ready.\n"
        "- study_profile_update: JSON object of extracted user facts for the Learning Draft Box.\n"
        "\n"
        "CRITICAL: NEVER recite background stats, degree, or previous goal details in greetings!\n"
        "CRITICAL: Put roadmap data ONLY in draft_roadmap when phase is draft or ready.\n"
        "IMPORTANT: Do NOT start responses with 'I see you are studying X'."
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
                    result["message"] = result["message"].replace("\\n", "\n")

                # Ensure required fields exist
                if "message" not in result:
                    result["message"] = "Let me help you build your learning path."
                if "phase" not in result:
                    result["phase"] = "discovery"

                # Programmatic guardrail: if phase is not "draft" or "ready", clear the draft_roadmap!
                if result.get("phase") not in ["draft", "ready"]:
                    result["draft_roadmap"] = None
                    result["goal_title"] = None
                
                return result

        except RateLimitError as e:
            logger.error(f"Groq Rate Limit during onboarding (attempt {attempt+1}): {e}")
            if attempt == 2:
                raise
            await asyncio.sleep(2.0)
        except APIError as e:
            logger.error(f"Groq API Error during onboarding (attempt {attempt+1}): {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in onboarding chat: {e}")
            raise

    raise ValueError("Failed to get valid response from AI after multiple attempts.")


async def generate_documentation(topic: str, research_data: str, transcript: str = None) -> str:
    """Generate a structured study guide for a topic using research data and optionally a YouTube transcript."""
    system_prompt = (
        "You are Edxiom AI, a high-fidelity learning assistant. "
        "Your goal is to create a comprehensive, engaging, and structured study guide "
        "based on the provided raw research data and any provided video transcripts/content. "
        "### GUIDELINES:\n"
        "1. **Structured Layout**: Use Markdown headers (##, ###).\n"
        "2. **Content Depth**: Explain core concepts, 'why it matters', and 'how it works' in detail.\n"
        "3. **Visual Aids**: Use bullet points, bold text for key terms, and code blocks if applicable.\n"
        "4. **Tone**: Intellectual, professional, yet accessible.\n"
        "5. **Formatting**: Ensure it looks premium when rendered in a dark-themed UI.\n"
        "\n"
        "Return ONLY the Markdown content, no conversational fillers."
    )
    if transcript:
        user_prompt = f"Topic: {topic}\n\nResearch Data:\n{research_data}\n\nYouTube Video Transcript:\n{transcript[:15000]}"
    else:
        user_prompt = f"Topic: {topic}\n\nResearch Data:\n{research_data}"

    return await call_groq(system_prompt, user_prompt)


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
        "1. Synthesize a clean, professional, and specific Goal Title for the course (do not just copy the raw playlist title).\n"
        "2. Organize EVERY SINGLE ONE of these videos in chronological order into logical Modules.\n"
        "3. For each module, generate a clean, professional synthesized Module Name (do not just use 'Chapter X' - create an educational, descriptive name).\n"
        "4. For each video in a module, generate a clean, professional synthesized Module Task (Part) Name that describes what is taught in that video (do not just copy raw video titles which often have filler like 'Striver', 'In One Shot', '| DSA Playlist', etc. Clean them up into proper learning subtopics).\n"
        "\n"
        "Return ONLY a JSON object with this exact structure:\n"
        "{\n"
        '  "goal_title": "Synthesized Specific Goal Title",\n'
        '  "roadmap": [\n'
        "    {\n"
        '      "title": "Synthesized Module Name 1",\n'
        '      "parts": [\n'
        '        {"title": "Synthesized Module Task 1", "video_index": 0},\n'
        '        {"title": "Synthesized Module Task 2", "video_index": 1}\n'
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Ensure every input video index from 0 to the last video index is assigned to exactly one part in ascending sequential order.\n"
        "No markdown, no explanation, ONLY valid JSON."
    )
    user_prompt = f"Playlist Title: {playlist_title}\n\nVideos:\n{video_list_str}\n\nGenerate the structured JSON roadmap."

    structured_roadmap = []
    goal_title = playlist_title
    
    try:
        raw = await call_groq(system_prompt, user_prompt)
        cleaned = _clean_json(raw)
        parsed = json.loads(cleaned)
        
        goal_title = parsed.get("goal_title", playlist_title)
        parsed_chapters = parsed.get("roadmap", [])
        
        for chapter in parsed_chapters:
            chapter_title = chapter.get("title", f"Module {len(structured_roadmap) + 1}")
            parts = []
            for part_item in chapter.get("parts", []):
                if isinstance(part_item, dict):
                    idx = part_item.get("video_index")
                    p_title = part_item.get("title", "Untitled Part")
                    if idx is not None and 0 <= idx < len(videos):
                        v = videos[idx]
                        parts.append(f"{p_title} || {v['video_id']}")
                elif isinstance(part_item, str):
                    parts.append(part_item)
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
        for i in range(0, len(videos), chunk_size):
            chunk = videos[i:i+chunk_size]
            chapter_title = f"Module {i//chunk_size + 1}: {chunk[0]['title']}"
            parts = [f"{v['title']} || {v['video_id']}" for v in chunk]
            structured_roadmap.append({
                "title": chapter_title,
                "parts": parts
            })

    normalized_roadmap = _normalize_draft_roadmap(structured_roadmap)
    return {
        "goal_title": goal_title,
        "roadmap": normalized_roadmap
    }

