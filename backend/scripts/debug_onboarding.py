import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.groq import generate_onboarding_response

async def main():
    import json

    # Test 1: General study question (should get phase='chat', no roadmap)
    print("=" * 50)
    print("TEST 1: General study question")
    print("=" * 50)
    messages1 = [
        {"role": "user", "content": "What is recursion in programming?"}
    ]
    res1 = await generate_onboarding_response(messages1)
    print(json.dumps(res1, indent=2))
    print(f"\n✅ Phase: {res1.get('phase')} | Has roadmap: {'draft_roadmap' in res1 and res1['draft_roadmap'] is not None}")

    # Test 2: Roadmap creation request
    print("\n" + "=" * 50)
    print("TEST 2: Create a learning path")
    print("=" * 50)
    messages2 = [
        {"role": "user", "content": "Create a learning path for Python programming in 2 weeks"}
    ]
    res2 = await generate_onboarding_response(messages2)
    print(json.dumps(res2, indent=2))
    print(f"\n✅ Phase: {res2.get('phase')} | Has roadmap: {'draft_roadmap' in res2 and res2['draft_roadmap'] is not None}")

if __name__ == "__main__":
    asyncio.run(main())
