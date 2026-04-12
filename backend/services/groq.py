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
    
    # Try to find a JSON object using regex if standard strip fails
    try:
        match = re.search(r'(\{.*\}|\[.*\])', cleaned, re.DOTALL)
        if match:
            cleaned = match.group(0)
    except Exception:
        pass

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
    """Handle the conversational onboarding logic with Axiom AI, including manual internet search."""
    import re
    
    system_prompt = (
        "You are Axiom AI, a high-accountability learning coach for the Axiom platform. "
        "Your goal is to help the user define a razor-sharp learning goal and generate a roadmap. "
        "\n"
        "### INTERNET CAPABILITY:\n"
        "If you need information you don't have (like recent cut-offs, specific syllabus details, or trends), "
        "you can perform a search by outputting the specific tag: <axiom_search>your query here</axiom_search>. "
        "When you use this tag, the system will provide you with the search results in the next turn.\n\n"
        "### PHASES OF CONVERSATION:\n"
        "1. **Discovery**: Ask about their current status (College, entrance exams, job prep) and what they want to master.\n"
        "2. **Timeline**: Ask about their desired time period for this learning goal.\n"
        "3. **Syllabus**: Ask if they have an existing syllabus (they can paste it) or if you should generate one.\n"
        "4. **Drafting**: Once you have enough info, generate a structured roadmap.\n"
        "5. **Refinement**: Ask if they want to change anything. If they are happy, signal we are ready.\n"
        "\n"
        "### OUTPUT FORMAT:\n"
        "You must return a JSON object. If you are searching, return ONLY the search tag. "
        "Otherwise, return the JSON object with:\n"
        "- 'message': Your conversational response.\n"
        "- 'phase': Current phase ('discovery', 'timeline', 'syllabus', 'draft', 'refinement', 'ready').\n"
        "- 'draft_roadmap': (Optional) roadmap array for drafting/refinement/ready phases.\n"
        "\n"
        "Return ONLY valid JSON (or the search tag), no conversational fillers outside the JSON."
    )

    current_messages = [{"role": "system", "content": system_prompt}] + messages

    async with httpx.AsyncClient(timeout=60.0) as client:
        for _ in range(3):  # Allow up to 2 search rounds
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
                        return json.loads(cleaned)
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON Parse Error in onboarding chat: {e}\nRaw Content: {raw_content[:500]}...")
                        # If still failing, try one more time explicitly forcing JSON
                        if _ == 2: raise 
                        current_messages.append({"role": "user", "content": "Error: Your response was not valid JSON. Please provide ONLY the JSON object now."})
                        continue

            except httpx.HTTPStatusError as e:
                logger.error(f"Groq API Error during onboarding: Status {e.response.status_code} - {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"Unexpected error in onboarding chat: {e}")
                raise

    raise ValueError("Failed to get valid response from AI after multiple attempts.")

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
