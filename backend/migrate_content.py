import asyncio
import os
from sqlalchemy import text
from database import engine

async def migrate():
    print("🚀 Running migration: adding 'content' to 'parts'...")
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE parts ADD COLUMN content TEXT;"))
            print("✅ Migration successful!")
        except Exception as e:
            if "already exists" in str(e):
                print("⚠️ Column already exists, skipping.")
            else:
                print(f"❌ Migration failed: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
