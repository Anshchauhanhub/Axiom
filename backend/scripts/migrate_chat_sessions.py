import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import DATABASE_URL, use_ssl

async def run_migration():
    print(f"Connecting to {DATABASE_URL}...")
    engine = create_async_engine(
        DATABASE_URL,
        connect_args={"ssl": True} if use_ssl else {}
    )

    async with engine.begin() as conn:
        print("Creating chat_sessions table if it doesn't exist...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        
        print("Adding session_id to chat_messages if it doesn't exist...")
        try:
            await conn.execute(text("""
                ALTER TABLE chat_messages
                ADD COLUMN session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE
            """))
            print("Successfully added session_id to chat_messages.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("session_id column already exists.")
            else:
                print(f"Error adding column (might be SQLite or syntax error): {e}")
                
    print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(run_migration())
