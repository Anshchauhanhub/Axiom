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
    """Handle the conversational onboarding logic with Axiom AI, including internet search."""
    system_prompt = (
        "You are Axiom AI, a high-accountability learning coach for the Axiom platform. "
        "Your goal is to help the user define a razor-sharp learning goal and generate a roadmap. "
        "\n"
        "### INTERNET CAPABILITY:\n"
        "You have access to a `search_internet` tool. If a user asks for information you don't know (like recent cut-offs, specific syllabus details, or trends), use this tool immediately to provide accurate data.\n\n"
        "### PHASES OF CONVERSATION:\n"
        "1. **Discovery**: Ask about their current status (College, entrance exams, job prep) and what they want to master.\n"
        "2. **Timeline**: Ask about their desired time period for this learning goal.\n"
        "3. **Syllabus**: Ask if they have an existing syllabus (they can paste it) or if you should generate one.\n"
        "4. **Drafting**: Once you have enough info, generate a structured roadmap.\n"
        "5. **Refinement**: Ask if they want to change anything. If they are happy, signal we are ready.\n"
        "\n"
        "### OUTPUT FORMAT:\n"
        "1. If you need more information, use the `search_internet` tool first.\n"
        "2. Once you have all required info, return a JSON object with:\n"
        "- 'message': Your conversational response.\n"
        "- 'phase': Current phase ('discovery', 'timeline', 'syllabus', 'draft', 'refinement', 'ready').\n"
        "- 'draft_roadmap': (Optional) roadmap array for drafting/refinement/ready phases.\n"
        "\n"
        "Ensure the final output is a valid JSON object."
    )

    tools = [
        {
            "type": "function",
            "function": {
                "name": "search_internet",
                "description": "Search the internet for real-time information, syllabus details, or learning trends.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query to perform."
                        }
                    },
                    "required": ["query"]
                }
            }
        }
    ]

    current_messages = [{"role": "system", "content": system_prompt}] + messages

    async with httpx.AsyncClient(timeout=60.0) as client:
        for _ in range(3):  # Allow up to 2 tool-call rounds
            try:
                # 1. Ask model (with tools enabled)
                payload = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": current_messages,
                    "temperature": 0.7,
                    "tools": tools,
                    "tool_choice": "auto"
                }
                
                # If we've already done tool calls, we might want to enforce JSON at the end
                # but llama-3.3-70b is good enough to follow JSON instructions even without response_format if tools used.
                
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
                message = data["choices"][0]["message"]

                # 2. Check for tool calls
                if message.get("tool_calls"):
                    tool_calls = message["tool_calls"]
                    current_messages.append(message)
                    
                    for tool_call in tool_calls:
                        function_name = tool_call["function"]["name"]
                        arguments = json.loads(tool_call["function"]["arguments"])
                        
                        if function_name == "search_internet":
                            search_results = await search_internet(arguments["query"])
                            current_messages.append({
                                "role": "tool",
                                "tool_call_id": tool_call["id"],
                                "name": function_name,
                                "content": search_results
                            })
                    
                    # Continue loop to give results back to LLM
                    continue
                else:
                    # 3. No tool calls? Clean and return JSON
                    raw_content = message["content"]
                    cleaned = _clean_json(raw_content)
                    try:
                        return json.loads(cleaned)
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON Parse Error in onboarding chat: {e}\nRaw Content: {raw_content[:500]}...")
                        # If still failing, try one more time explicitly forcing JSON
                        if _ == 2: raise # Give up on last loop
                        current_messages.append({"role": "user", "content": "You must return valid JSON only."})
                        continue

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
