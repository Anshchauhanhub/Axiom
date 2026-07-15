import asyncio
import httpx
import os
import json
from dotenv import load_dotenv

async def test_groq():
    load_dotenv()
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("GROQ_API_KEY missing!")
        return

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    # Minimal version of the prompt/request
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Generate 3 MCQs on 'Arrays' in JSON format: {questions: [{question, options:[], correct:index}]}"},
            {"role": "user", "content": "Arrays in DSA"}
        ],
        "temperature": 0.6,
        "response_format": {"type": "json_object"}
    }

    print("Sending request to Groq...")
    start_time = asyncio.get_event_loop().time()
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            end_time = asyncio.get_event_loop().time()
            print(f"Status: {response.status_code}")
            print(f"Time taken: {end_time - start_time:.2f}s")
            # print(response.text)
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_groq())
