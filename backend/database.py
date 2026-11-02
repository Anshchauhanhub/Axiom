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

import ssl

# Railway/Render/Neon/Supabase/Aiven require SSL, but local dev might not.
# We'll use ssl if a remote database host or sslmode=require is detected in the URL.
use_ssl = any(k in DATABASE_URL for k in ("railway", "render", "neon.tech", "supabase.co", "aivencloud.com", "aiven.io", "sslmode=require")) if DATABASE_URL else False

# Cloud PostgreSQL providers (like Aiven or self-hosted) use CA certificates that may not be in default system trust store.
if use_ssl:
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    connect_args = {"ssl": ssl_ctx}
else:
    connect_args = {}

clean_db_url = DATABASE_URL
if clean_db_url and "?sslmode=" in clean_db_url:
    clean_db_url = clean_db_url.split("?sslmode=")[0]
elif clean_db_url and "&sslmode=" in clean_db_url:
    clean_db_url = clean_db_url.split("&sslmode=")[0]

engine = create_async_engine(
    clean_db_url,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    connect_args=connect_args
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

