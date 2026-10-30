import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault(
    "DATABASE_URL", "postgresql://localhost:5433/career_compass_rag_test"
)

import asyncpg  # noqa: E402

from db.migrate import _discover_migrations, run_migrations  # noqa: E402


async def test_run_migrations_is_idempotent(pool, settings):
    """The `pool` fixture's setup already ran init_schema() once — a second
    explicit run here must apply nothing and leave the bookkeeping table
    untouched, even though the target tables now hold data (the fixture's
    TRUNCATE doesn't touch schema_migrations).
    """
    conn = await asyncpg.connect(settings.database_url)
    try:
        before = await conn.fetch("SELECT version FROM schema_migrations ORDER BY version")
    finally:
        await conn.close()
    assert len(before) > 0

    applied = await run_migrations(settings.database_url)
    assert applied == 0

    conn = await asyncpg.connect(settings.database_url)
    try:
        after = await conn.fetch("SELECT version FROM schema_migrations ORDER BY version")
    finally:
        await conn.close()
    assert before == after


async def test_run_migrations_applies_cleanly_to_a_fresh_database(settings):
    """Guards the from-empty path specifically — the shared test DB is
    never actually empty by the time the `pool` fixture runs. Uses a
    scratch, same-server database dropped at the end of the test.
    """
    server_url = settings.database_url.rsplit("/", 1)[0]
    admin_conn = await asyncpg.connect(f"{server_url}/postgres")
    try:
        await admin_conn.execute('DROP DATABASE IF EXISTS "migrate_fresh_test"')
        await admin_conn.execute('CREATE DATABASE "migrate_fresh_test"')
    finally:
        await admin_conn.close()

    fresh_url = f"{server_url}/migrate_fresh_test"
    try:
        first_run = await run_migrations(fresh_url)
        assert first_run > 0

        conn = await asyncpg.connect(fresh_url)
        try:
            tables = {
                r["tablename"]
                for r in await conn.fetch(
                    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
                )
            }
        finally:
            await conn.close()
        assert {
            "knowledge_documents", "chunks", "prompt_templates", "retrieval_logs",
            "runtime_settings", "knowledge_categories", "knowledge_document_events",
            "schema_migrations",
        } <= tables

        assert await run_migrations(fresh_url) == 0
    finally:
        admin_conn = await asyncpg.connect(f"{server_url}/postgres")
        try:
            await admin_conn.execute('DROP DATABASE IF EXISTS "migrate_fresh_test"')
        finally:
            await admin_conn.close()


async def test_run_migrations_is_safe_under_concurrent_boot(settings):
    """Regression test for a real bug caught during development: an
    earlier version of run_migrations() ran `CREATE EXTENSION IF NOT
    EXISTS vector` *before* acquiring the advisory lock — Postgres's own
    `IF NOT EXISTS` DDL isn't safe under true concurrent execution (two
    sessions can both pass the existence check, then collide on the
    catalog's unique index). Mirrors infra/k8s/ai-service's replicas: 2
    booting against the same fresh database at once.
    """
    server_url = settings.database_url.rsplit("/", 1)[0]
    admin_conn = await asyncpg.connect(f"{server_url}/postgres")
    try:
        await admin_conn.execute('DROP DATABASE IF EXISTS "migrate_concurrent_test"')
        await admin_conn.execute('CREATE DATABASE "migrate_concurrent_test"')
    finally:
        await admin_conn.close()

    fresh_url = f"{server_url}/migrate_concurrent_test"
    try:
        results = await asyncio.gather(
            run_migrations(fresh_url), run_migrations(fresh_url), run_migrations(fresh_url),
        )
        # No exception from any runner, and the migrations were applied
        # exactly once in total — whichever replica lost the advisory
        # lock race found nothing left pending once its turn came.
        assert sum(results) == len(_discover_migrations())
    finally:
        admin_conn = await asyncpg.connect(f"{server_url}/postgres")
        try:
            await admin_conn.execute('DROP DATABASE IF EXISTS "migrate_concurrent_test"')
        finally:
            await admin_conn.close()
