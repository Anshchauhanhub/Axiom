"""
Migration script: Copy entire schema and data from Neon Postgres to Aiven Postgres.
Usage:
    .venv/bin/python backend/scripts/migrate_neon_to_aiven.py --aiven-url "postgres://avnadmin:pass@host:port/defaultdb?sslmode=require"
"""

import sys
import os
import argparse
import asyncio
import asyncpg
import ssl
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import models
from database import Base

TABLES_IN_ORDER = [
    "users",
    "roadmap_templates",
    "goals",
    "tasks",
    "parts",
    "part_study_resources",
    "chat_sessions",
    "chat_messages",
    "active_quizzes",
    "quiz_results",
    "personal_tasks",
    "study_sessions",
    "social_posts",
    "social_comments",
    "post_likes",
    "follows",
    "direct_messages"
]

def clean_asyncpg_dsn(url: str) -> str:
    url = url.replace("postgresql+asyncpg://", "postgresql://")
    if "?sslmode=" in url:
        url = url.split("?sslmode=")[0]
    elif "&sslmode=" in url:
        url = url.split("&sslmode=")[0]
    return url

async def main():
    parser = argparse.ArgumentParser(description="Migrate data from Neon to Aiven PostgreSQL")
    parser.add_argument("--neon-url", default=None, help="Neon PostgreSQL URL (defaults to backend/.env DATABASE_URL)")
    parser.add_argument("--aiven-url", required=True, help="Aiven PostgreSQL Service URI")
    args = parser.parse_args()

    neon_url = args.neon_url
    if not neon_url:
        from dotenv import load_dotenv
        load_dotenv("backend/.env")
        neon_url = os.getenv("DATABASE_URL")

    if not neon_url:
        print("❌ Error: Neon DATABASE_URL not found!")
        sys.exit(1)

    aiven_raw = args.aiven_url.strip()
    print("==================================================")
    print("🚀 Axiom Database Migration: Neon -> Aiven")
    print("==================================================")

    neon_dsn = clean_asyncpg_dsn(neon_url)
    aiven_dsn = clean_asyncpg_dsn(aiven_raw)

    neon_ssl = ssl.create_default_context()
    neon_ssl.check_hostname = False
    neon_ssl.verify_mode = ssl.CERT_NONE

    aiven_ssl = ssl.create_default_context()
    aiven_ssl.check_hostname = False
    aiven_ssl.verify_mode = ssl.CERT_NONE

    print(f"Connecting to Neon: {neon_dsn.split('@')[-1]}")
    neon_conn = await asyncpg.connect(neon_dsn, ssl=neon_ssl)
    print("✅ Connected to Neon.")

    print(f"Connecting to Aiven: {aiven_dsn.split('@')[-1]}")
    aiven_conn = await asyncpg.connect(aiven_dsn, ssl=aiven_ssl)
    print("✅ Connected to Aiven.")

    # 1. Enable pgvector if available on Aiven
    try:
        await aiven_conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        print("✅ pgvector extension enabled on Aiven.")
    except Exception as e:
        print(f"⚠️ Warning enabling pgvector: {e}")

    # 2. Create schema tables using SQLAlchemy
    print("\nInitializing schema tables on Aiven via SQLAlchemy models...")
    aiven_sa_url = aiven_dsn
    if aiven_sa_url.startswith("postgres://"):
        aiven_sa_url = aiven_sa_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif aiven_sa_url.startswith("postgresql://"):
        aiven_sa_url = aiven_sa_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    target_engine = create_async_engine(
        aiven_sa_url,
        connect_args={"ssl": aiven_ssl}
    )
    async with target_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await target_engine.dispose()
    print("✅ Schema initialized successfully.")

    # 3. Synchronize any schema columns from Neon that exist in Neon but weren't in initial create_all
    print("\nAligning table column definitions...")
    for table in TABLES_IN_ORDER:
        # Check if table exists in Neon
        table_exists = await neon_conn.fetchval(f"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '{table}');")
        if not table_exists:
            continue

        # Check if table exists in Aiven
        aiven_table_exists = await aiven_conn.fetchval(f"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '{table}');")
        if not aiven_table_exists:
            continue

        src_cols = await neon_conn.fetch(f"""
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = '{table}';
        """)
        dst_cols_res = await aiven_conn.fetch(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '{table}';
        """)
        dst_col_names = {r["column_name"] for r in dst_cols_res}

        for sc in src_cols:
            cname = sc["column_name"]
            if cname not in dst_col_names:
                udt = sc["udt_name"]
                col_type = udt.upper()
                if udt == "varchar":
                    col_type = "VARCHAR"
                elif udt == "int4":
                    col_type = "INTEGER"
                elif udt == "int8":
                    col_type = "BIGINT"
                elif udt == "bool":
                    col_type = "BOOLEAN"
                elif udt == "timestamptz":
                    col_type = "TIMESTAMP WITH TIME ZONE"
                elif udt == "jsonb":
                    col_type = "JSONB"
                elif udt == "uuid":
                    col_type = "UUID"
                elif udt == "text":
                    col_type = "TEXT"
                elif udt == "vector":
                    col_type = "vector"

                try:
                    await aiven_conn.execute(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS "{cname}" {col_type};')
                    print(f"  + Added column {table}.{cname} ({col_type}) to Aiven")
                except Exception as e:
                    print(f"  ⚠️ Could not add column {table}.{cname}: {e}")

    # 4. Migrate data table by table
    print("\nMigrating data table by table...")
    audit_results = {}

    for table in TABLES_IN_ORDER:
        table_exists = await neon_conn.fetchval(f"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '{table}');")
        if not table_exists:
            continue
        aiven_table_exists = await aiven_conn.fetchval(f"SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = '{table}');")
        if not aiven_table_exists:
            continue

        # Check source count
        src_count = await neon_conn.fetchval(f"SELECT count(*) FROM {table};")
        if src_count == 0:
            audit_results[table] = (0, 0)
            print(f"  • {table}: 0 rows (skipped)")
            continue

        # Get common columns between source and destination
        dst_cols_res = await aiven_conn.fetch(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '{table}';
        """)
        dst_col_set = {r["column_name"] for r in dst_cols_res}

        src_rows = await neon_conn.fetch(f"SELECT * FROM {table};")
        if not src_rows:
            audit_results[table] = (src_count, 0)
            continue

        raw_columns = list(src_rows[0].keys())
        columns = [c for c in raw_columns if c in dst_col_set]

        col_names = ", ".join(f'"{c}"' for c in columns)
        val_placeholders = ", ".join(f"${i+1}" for i in range(len(columns)))

        insert_query = f"""
            INSERT INTO {table} ({col_names})
            VALUES ({val_placeholders})
            ON CONFLICT DO NOTHING;
        """

        # Batch insert
        for row in src_rows:
            vals = [row[c] for c in columns]
            await aiven_conn.execute(insert_query, *vals)

        dest_count = await aiven_conn.fetchval(f"SELECT count(*) FROM {table};")
        audit_results[table] = (src_count, dest_count)
        status_icon = "✅" if src_count == dest_count else "⚠️"
        print(f"  {status_icon} {table}: {src_count} source rows -> {dest_count} Aiven rows")

    await neon_conn.close()
    await aiven_conn.close()

    print("\n==================================================")
    print("🏁 Migration Complete! Summary:")
    print("==================================================")
    all_matched = True
    for table, (src, dst) in audit_results.items():
        matched = (src == dst)
        if not matched:
            all_matched = False
        print(f"  {'✅' if matched else '❌'} {table:22}: Neon={src:4} | Aiven={dst:4}")

    if all_matched:
        print("\n🎉 100% of rows transferred without loss!")
    else:
        print("\n⚠️ Some tables had row count discrepancies. Please review above.")

if __name__ == "__main__":
    asyncio.run(main())
