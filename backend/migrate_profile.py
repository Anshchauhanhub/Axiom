import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def migrate():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR;"))
            print("Added full_name column.")
        except Exception as e:
            print("full_name column may already exist:", e)
            
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN profile_image_url VARCHAR;"))
            print("Added profile_image_url column.")
        except Exception as e:
            print("profile_image_url column may already exist:", e)

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
