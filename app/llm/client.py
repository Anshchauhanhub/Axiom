"""
LLM Client — Gemini Flash via Google GenAI SDK.

All LLM calls go through this module so we can swap providers later.
"""

import json

from google import genai
from google.genai import types

from app.config import settings
from app.llm.prompts import ROADMAP_SYSTEM_PROMPT, MCQ_SYSTEM_PROMPT
from app.llm.parsers import validate_roadmap_json, validate_mcq_json

client = genai.Client(api_key=settings.GEMINI_API_KEY)

MODEL = "gemini-2.0-flash"


async def generate_json_roadmap(syllabus_text: str) -> dict:
    """
    Send the syllabus to Gemini and get a structured JSON roadmap back.

    Returns a validated dict matching the RoadmapPlan schema.
    """
    response = client.models.generate_content(
        model=MODEL,
        contents=syllabus_text,
        config=types.GenerateContentConfig(
            system_instruction=ROADMAP_SYSTEM_PROMPT,
            response_mime_type="application/json",
            temperature=0.4,
        ),
    )

    raw_json = json.loads(response.text)
    validated = validate_roadmap_json(raw_json)
    return validated


async def generate_mcq_quiz(context: str) -> dict:
    """
    Generate 5 MCQs for a given topic/chapter context.

    Returns a validated dict matching the MCQQuiz schema.
    """
    response = client.models.generate_content(
        model=MODEL,
        contents=context,
        config=types.GenerateContentConfig(
            system_instruction=MCQ_SYSTEM_PROMPT,
            response_mime_type="application/json",
            temperature=0.6,
        ),
    )

    raw_json = json.loads(response.text)
    validated = validate_mcq_json(raw_json)
    return validated
