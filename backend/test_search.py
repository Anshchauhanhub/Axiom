import asyncio
import os
import json
import logging
from services.groq import generate_onboarding_response

logging.basicConfig(level=logging.INFO)

async def test_search_awareness():
    print("🚀 Testing Search Awareness...")
    
    messages = [
        {"role": "user", "content": "can you find the cutoff of gate 2026"}
    ]
    
    try:
        response = await generate_onboarding_response(messages)
        print("\n✅ Response Received:")
        print(json.dumps(response, indent=2))
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_search_awareness())
