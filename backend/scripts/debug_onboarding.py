import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.groq import generate_onboarding_response

async def main():
    messages = [
        {"role": "assistant", "content": "Welcome to Axiom. I am your high-accountability coach. To build your optimal neural path, tell me: Are you currently in college, preparing for entrances, or focused on job mastery?"},
        {"role": "user", "content": "job mastery in ML Ops"},
        {"role": "assistant", "content": "Excellent choice. ML Ops is a high-impact field. What's your target timeline for achieving mastery? (e.g., 3 months, 6 months, 1 year)"},
        {"role": "user", "content": "1 week"},
        {"role": "assistant", "content": "Given the short timeline of 1 week, we'll need to focus on the most critical aspects of ML Ops. Do you have an existing syllabus or a list of topics you'd like to cover, or would you like me to suggest a condensed syllabus for you?"},
        {"role": "user", "content": "no"}
    ]
    
    print("🚀 Sending request to Groq...")
    try:
        response = await generate_onboarding_response(messages)
        print("✅ Response received:")
        import json
        print(json.dumps(response, indent=2))
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
