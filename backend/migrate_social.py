import asyncio
from database import engine, Base
import models

async def migrate():
    async with engine.begin() as conn:
        # This will create tables that don't exist yet
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database migration complete: Social tables created.")

if __name__ == "__main__":
    asyncio.run(migrate())
