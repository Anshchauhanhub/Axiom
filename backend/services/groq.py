import os
import json
import logging
import httpx
from dotenv import load_dotenv

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
    """Strip markdown code fences from LLM response."""
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


async def generate_onboarding_response(messages: list[dict]) -> dict:
    """Handle the conversational onboarding logic with Axiom AI."""
    system_prompt = (
        "You are Axiom AI, a high-accountability learning coach for the Axiom platform. "
        "Your goal is to help the user define a razor-sharp learning goal and generate a roadmap. "
        "### PHASES OF CONVERSATION:\n"
        "1. **Discovery**: Ask about their current status (College, entrance exams, job prep) and what they want to master.\n"
        "2. **Timeline**: Ask about their desired time period for this learning goal.\n"
        "3. **Syllabus**: Ask if they have an existing syllabus (they can paste it) or if you should generate one.\n"
        "4. **Drafting**: Once you have enough info, generate a structured roadmap.\n"
        "5. **Refinement**: Ask if they want to change anything. If they are happy, signal we are ready.\n"
        "\n"
        "### OUTPUT FORMAT:\n"
        "You MUST return a JSON object with the following fields:\n"
        "- 'message': Your conversational response to the user. When moving to 'ready' phase, explicitly tell them: 'If you are satisfied with this neural path, please click the \"Activate Neural Path\" button below to begin.'\n"
        "- 'phase': Current phase ('discovery', 'timeline', 'syllabus', 'draft', 'refinement', 'ready').\n"
        "- 'draft_roadmap': (Optional) If you are in 'draft', 'refinement', or 'ready' phase, include a JSON array of tasks "
        "exactly like generate_roadmap does (each task has: 'title', 'parts' [array of strings]).\n"
        "\n"
        "Return ONLY the valid JSON object, no explanation outside of the 'message' field. "
        "When generating 'draft_roadmap', ensure it is exhaustive and high-fidelity, usually 10-15 tasks "
        "with 5-8 sub-parts each to cover the entire curriculum depth."
    )

    # Note: Using the multi-turn chat approach
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
                    "messages": [{"role": "system", "content": system_prompt}] + messages,
                    "temperature": 0.7,
                    "response_format": {"type": "json_object"}
                },
            )
            response.raise_for_status()
            data = response.json()
            raw_content = data["choices"][0]["message"]["content"]
            return json.loads(raw_content)
        except Exception as e:
            logger.error(f"Error in onboarding chat: {e}")
            raise
