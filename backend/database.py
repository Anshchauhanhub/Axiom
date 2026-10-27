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
        # Note: Schema migrations (adding/dropping columns) should be handled through Alembic.

