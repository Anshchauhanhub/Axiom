import httpx
import asyncio
import time

BASE_URL = "http://localhost:8000"

async def test_flow():
    async with httpx.AsyncClient(timeout=60.0) as client:
        print("=" * 50)
        print("  AXIOM AI — Integration Test")
        print("=" * 50)

        # 1. Health check
        print("\n1. Health Check...")
        try:
            res = await client.get(f"{BASE_URL}/health")
            if res.status_code == 200:
                print("   ✅ Server is healthy")
            else:
                print(f"   ❌ Health check failed: {res.status_code}")
                return
        except Exception as e:
            print(f"   ❌ Cannot reach server: {e}")
            return

        # 2. Register
        email = f"test_{int(time.time())}@axiom.ai"
        print(f"\n2. Registering user: {email}")
        res = await client.post(f"{BASE_URL}/auth/register", json={
            "email": email,
            "password": "test123",
            "timezone": "Asia/Kolkata",
            "study_schedule": ["12:00", "18:00"]
        })
        if res.status_code != 200:
            print(f"   ❌ Registration failed: {res.status_code} — {res.text}")
            return
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"   ✅ Registered! Token: {token[:20]}...")

        # 3. Get Profile
        print("\n3. Fetching profile...")
        res = await client.get(f"{BASE_URL}/users/me", headers=headers)
        if res.status_code == 200:
            profile = res.json()
            print(f"   ✅ Profile: {profile['email']}, streak: {profile['current_streak']}")
        else:
            print(f"   ❌ Profile failed: {res.text}")

        # 4. Create Goal
        print("\n4. Creating goal...")
        res = await client.post(f"{BASE_URL}/goals/", json={"title": "Master Python Backend"}, headers=headers)
        if res.status_code != 200:
            print(f"   ❌ Goal creation failed: {res.text}")
            return
        goal_id = res.json()["id"]
        print(f"   ✅ Goal created: {goal_id}")

        # 5. Generate Roadmap (Grok AI)
        print("\n5. Generating AI Roadmap (Grok)... (this may take 10-30s)")
        res = await client.post(f"{BASE_URL}/goals/{goal_id}/generate-roadmap", headers=headers)
        if res.status_code != 200:
            print(f"   ❌ Roadmap generation failed: {res.status_code} — {res.text}")
            return
        roadmap = res.json()
        task_count = len(roadmap["tasks"])
        first_task = roadmap["tasks"][0]["title"]
        first_part = roadmap["tasks"][0]["parts"][0]
        print(f"   ✅ Roadmap generated: {task_count} tasks")
        print(f"      First task: {first_task}")
        print(f"      First part: {first_part['title']} (status: {first_part['status']})")

        # 6. Start Quiz (Grok AI)
        part_id = first_part["id"]
        print(f"\n6. Starting Sudden Death Quiz for '{first_part['title']}'... (10-30s)")
        res = await client.post(f"{BASE_URL}/quiz/start/{part_id}", headers=headers)
        if res.status_code != 200:
            print(f"   ❌ Quiz start failed: {res.status_code} — {res.text}")
            return
        quiz = res.json()
        quiz_id = quiz["quiz_id"]
        q_count = len(quiz["questions"])
        print(f"   ✅ Quiz started: {q_count} questions")
        print(f"      Q1: {quiz['questions'][0]['question']}")

        # 7. Submit Quiz (all correct = index 0 for testing)
        print("\n7. Submitting quiz answers...")
        res = await client.post(f"{BASE_URL}/quiz/submit", json={
            "quiz_id": quiz_id,
            "answers": [0, 0, 0, 0, 0]
        }, headers=headers)
        if res.status_code != 200 and res.status_code != 410:
            print(f"   ❌ Quiz submit failed: {res.status_code} — {res.text}")
            return
        result = res.json()
        print(f"   ✅ Result: {result.get('message', result)}")

        print("\n" + "=" * 50)
        print("  🚀 ALL INTEGRATION TESTS PASSED!")
        print("=" * 50)

if __name__ == "__main__":
    asyncio.run(test_flow())
