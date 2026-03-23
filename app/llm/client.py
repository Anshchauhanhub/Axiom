"""
LLM Client — Groq API Backend.

All LLM calls go through this module so we can swap providers easily.
"""

import json
import httpx
from fastapi import HTTPException

from app.config import settings
from app.llm.prompts import ROADMAP_SYSTEM_PROMPT, MCQ_SYSTEM_PROMPT
from app.llm.parsers import validate_roadmap_json, validate_mcq_json

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
# Use a modern Llama 3.3 model (previous Llama 3 was decommissioned)
MODEL = "llama-3.3-70b-versatile"


async def generate_json_roadmap(syllabus_text: str) -> dict:
    """
    Send the syllabus to Groq and get a structured JSON roadmap back.
    """
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": ROADMAP_SYSTEM_PROMPT},
            {"role": "user", "content": syllabus_text}
        ],
        "temperature": 0.4,
        "response_format": {"type": "json_object"}
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(GROQ_URL, headers=headers, json=payload, timeout=60.0)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Groq API Error: {response.text}"
            )
        
        data = response.json()
        raw_json_str = data["choices"][0]["message"]["content"]
        
        try:
            raw_json = json.loads(raw_json_str)
        except json.JSONDecodeError:
            # Fallback if the model didn't perfectly return JSON
            # try to strip markdown ```json wrappers
            clean_str = raw_json_str.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            raw_json = json.loads(clean_str)

        return validate_roadmap_json(raw_json)


async def generate_mcq_quiz(context: str) -> dict:
    """
    Generate 5 MCQs for a given topic/chapter context using Groq.
    """
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": MCQ_SYSTEM_PROMPT},
            {"role": "user", "content": context}
        ],
        "temperature": 0.6,
        "response_format": {"type": "json_object"}
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(GROQ_URL, headers=headers, json=payload, timeout=60.0)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Groq API Error: {response.text}"
            )
        
        data = response.json()
        raw_json_str = data["choices"][0]["message"]["content"]
        
        try:
            raw_json = json.loads(raw_json_str)
        except json.JSONDecodeError:
            clean_str = raw_json_str.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            raw_json = json.loads(clean_str)

        return validate_mcq_json(raw_json)
