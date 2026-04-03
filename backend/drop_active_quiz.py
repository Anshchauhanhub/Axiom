import asyncio
from sqlalchemy import text
from database import engine

async def drop_active_quiz():
    async with engine.begin() as conn:
        print("🛠️ Dropping Table: active_quizzes...")
        await conn.execute(text("DROP TABLE IF EXISTS active_quizzes CASCADE;"))
        print("✅ active_quizzes dropped successfully.")

if __name__ == "__main__":
    asyncio.run(drop_active_quiz())
