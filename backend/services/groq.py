import os
import json
import logging
import httpx
from dotenv import load_dotenv
from services.search import search_internet

load_dotenv()

logger = logging.getLogger("axiom.groq")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")


async def call_groq(system_prompt: str, user_prompt: str) -> str:
    """Call Groq API with a system and user prompt. Returns raw text."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{GROQ_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as e:
            logger.error(f"API HTTP Error: {e.response.status_code} — {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"API Call Error: {e}")
            raise


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
        "You are Axiom AI, a high-accountability learning coach. "
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
    """Generate MCQ questions for a topic."""
    system_prompt = (
        f"You are Axiom AI's quiz engine. Generate exactly {count} multiple-choice questions. "
        "Return ONLY a JSON array where each item has: "
        '"question" (string), "options" (array of 4 strings), "correct_index" (int 0-3). '
        "Questions should be challenging and test deep understanding. "
        "No markdown, no explanation, ONLY valid JSON."
    )
    user_prompt = f"Generate {count} challenging MCQs about: {topic}"

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
            # Flat string → convert to object
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


async def generate_onboarding_response(messages: list[dict]) -> dict:
    """Handle versatile Axiom AI chat — general study Q&A + roadmap creation on demand."""
    import re
    
    system_prompt = (
        "You are Axiom AI, an elite AI study assistant and learning coach. "
        "You are like ChatGPT but specialized for students and learners. "
        "You can help with ANY study-related question — explanations, doubts, exam tips, career advice, "
        "concept breakdowns, code help, math problems, essay writing, and more.\n"
        "\n"
        "### YOUR CAPABILITIES:\n"
        "1. **General Study Help**: Answer any academic question, explain concepts, solve problems, give study tips.\n"
        "2. **Learning Path Creation**: When the user asks you to create a roadmap, learning path, or study plan, "
        "gather the necessary details (topic, timeline, existing syllabus) and then generate a structured roadmap.\n"
        "3. **Internet Search**: If you need current information (cut-offs, trends, latest syllabus), "
        "output the tag: <axiom_search>your query</axiom_search>. The system will provide results in the next turn.\n"
        "\n"
        "### BEHAVIOR RULES:\n"
        "- For general questions/conversation: set phase to 'chat'. Do NOT include draft_roadmap.\n"
        "- Only when the user EXPLICITLY asks to create a learning path/roadmap/study plan, "
        "start gathering info (topic → timeline → syllabus preference) before generating.\n"
        "- During roadmap creation, use phases: 'discovery' → 'timeline' → 'syllabus' → 'draft' → 'refinement' → 'ready'.\n"
        "- After roadmap is created, if user asks general questions, switch back to phase 'chat'.\n"
        "- Be conversational, helpful, and knowledgeable. Use markdown in your message for formatting "
        "(bold, lists, code blocks) when explaining concepts.\n"
        "\n"
        "### OUTPUT FORMAT:\n"
        "Return a single-line JSON object. Ensure all newlines in the 'message' field are escaped as \\n. "
        "If searching, return ONLY the search tag.\n"
        "Fields:\n"
        "- 'message': Your response (use markdown formatting for rich answers).\n"
        "- 'phase': 'chat' for general conversation, or a roadmap phase when creating a learning path.\n"
        "- 'draft_roadmap': (Only in 'draft'/'refinement'/'ready' phases) Array of objects: "
        "{\"title\": \"Task Name\", \"parts\": [\"subtopic1\", \"subtopic2\", ...]}. Generate 6-10 tasks with 3-6 parts each.\n"
        "\n"
        "EXAMPLES:\n"
        "General question: {\"message\": \"**Recursion** is when a function calls itself...\", \"phase\": \"chat\"}\n"
        "Roadmap draft: {\"message\": \"Here is your ML Ops roadmap.\", \"phase\": \"draft\", "
        "\"draft_roadmap\": [{\"title\": \"Intro to ML Ops\", \"parts\": [\"What is MLOps\", \"CI/CD for ML\"]}]}\n"
        "\n"
        "Return ONLY valid JSON (or the search tag). No markdown wrapping, no explanation outside the JSON."
    )

    current_messages = [{"role": "system", "content": system_prompt}] + messages

    async with httpx.AsyncClient(timeout=60.0) as client:
        for attempt in range(3):  # Allow up to 2 search rounds
            try:
                # 1. Ask model (manual tools, no native tools parameter)
                payload = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": current_messages,
                    "temperature": 0.7,
                }
                
                response = await client.post(
                    f"{GROQ_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                raw_content = data["choices"][0]["message"]["content"]
                
                # 2. Check for manual search tag: <axiom_search>query</axiom_search>
                search_match = re.search(r'<axiom_search>(.*?)</axiom_search>', raw_content, re.IGNORECASE | re.DOTALL)
                
                if search_match:
                    query = search_match.group(1).strip()
                    logger.info(f"🔍 Manual Search Triggered: '{query}'")
                    
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
                    
                    return result

            except httpx.HTTPStatusError as e:
                logger.error(f"Groq API Error during onboarding: Status {e.response.status_code} - {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"Unexpected error in onboarding chat: {e}")
                raise

    raise ValueError("Failed to get valid response from AI after multiple attempts.")


async def generate_documentation(topic: str, research_data: str) -> str:
    """Synthesize a structured study guide for a topic using research data."""
    system_prompt = (
        "You are Axiom AI, a high-fidelity learning synthesizer. "
        "Your goal is to create a comprehensive, engaging, and structured study guide "
        "based on the provided raw research data. "
        "### GUIDELINES:\n"
        "1. **Structured Layout**: Use Markdown headers (##, ###).\n"
        "2. **Content Depth**: Explain core concepts, 'why it matters', and 'how it works' in detail.\n"
        "3. **Visual Aids**: Use bullet points, bold text for key terms, and code blocks if applicable.\n"
        "4. **Tone**: Intellectual, professional, yet accessible.\n"
        "5. **Formatting**: Ensure it looks premium when rendered in a dark-themed UI.\n"
        "\n"
        "Return ONLY the Markdown content, no conversational fillers."
    )
    user_prompt = f"Topic: {topic}\n\nResearch Data:\n{research_data}"

    return await call_groq(system_prompt, user_prompt)
