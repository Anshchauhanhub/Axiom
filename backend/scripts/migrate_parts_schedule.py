import asyncio
import sys
import os
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import engine

async def migrate():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE parts ADD COLUMN scheduled_at TIMESTAMP WITH TIME ZONE NULL;"))
            print("Successfully added 'scheduled_at' column to 'parts' table.")
        except Exception as e:
            if "already exists" in str(e):
                print("Column 'scheduled_at' already exists.")
            else:
                print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
