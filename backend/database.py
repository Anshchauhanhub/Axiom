import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Please configure it in .env")
if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Railway/Render/Neon/Supabase require SSL, but local dev might not.
# We'll use ssl=True if a remote database host is detected in the URL.
use_ssl = any(k in DATABASE_URL for k in ("railway", "render", "neon.tech", "supabase.co")) if DATABASE_URL else False

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    connect_args={"ssl": True} if use_ssl else {}
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    # Keep local/fresh deployments bootable until Alembic version files exist.
    # Importing models registers their tables on Base.metadata.
    import models  # noqa: F401

    async with engine.begin() as conn:
        # Enable pgvector extension on database if available
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        except Exception as e:
            print(f"pgvector extension creation warning: {e}")

        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR NOT NULL DEFAULT 'student'"))
        await conn.execute(text("UPDATE users SET account_type = 'student' WHERE account_type IS NULL"))
        # Monetization: credit column
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 5"))
        # Persistent memory: study_profile column
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS study_profile JSONB DEFAULT '{}'::jsonb"))
        # Agentic system upgrade: roadmap template cache + goal tracking columns
        await conn.execute(text("ALTER TABLE goals ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES roadmap_templates(id)"))
        await conn.execute(text("ALTER TABLE goals ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN DEFAULT FALSE"))
        # Entity-detection + verification pipeline columns
        await conn.execute(text("ALTER TABLE roadmap_templates ADD COLUMN IF NOT EXISTS detected_entity TEXT"))
        await conn.execute(text("ALTER TABLE roadmap_templates ADD COLUMN IF NOT EXISTS verification_passed BOOLEAN DEFAULT TRUE"))
        await conn.execute(text("ALTER TABLE roadmap_templates ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ"))
        
        # Vector RAG migration (pgvector embedding column)
        try:
            await conn.execute(text("ALTER TABLE roadmap_templates ADD COLUMN IF NOT EXISTS embedding vector(384)"))
        except Exception as e:
            print(f"pgvector column migration warning (falling back to generic column): {e}")
            await conn.execute(text("ALTER TABLE roadmap_templates ADD COLUMN IF NOT EXISTS embedding TEXT"))
        await conn.execute(text("ALTER TABLE roadmap_templates DROP COLUMN IF EXISTS pinecone_vector_id"))

