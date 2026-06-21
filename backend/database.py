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

# Railway/Render usually require SSL, but local dev might not.
# We'll use ssl=True if 'railway' or 'render' is in the URL, or if specified.
use_ssl = "railway" in DATABASE_URL or "render" in DATABASE_URL if DATABASE_URL else False

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
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR NOT NULL DEFAULT 'student'"))
        await conn.execute(text("UPDATE users SET account_type = 'student' WHERE account_type IS NULL"))
