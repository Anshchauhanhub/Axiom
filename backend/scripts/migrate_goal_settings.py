import asyncio
from sqlalchemy import text
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import engine

async def migrate():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE goals ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;"))
            print("Successfully added 'settings' column to 'goals' table.")
        except Exception as e:
            if "already exists" in str(e):
                print("Column 'settings' already exists.")
            else:
                print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
