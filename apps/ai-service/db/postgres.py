import json

import asyncpg
from pgvector.asyncpg import register_vector

from config import get_settings
from db.migrate import run_migrations

_pool: asyncpg.Pool | None = None


async def _init_connection(conn: asyncpg.Connection) -> None:
    await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
    await register_vector(conn)
    # asyncpg returns jsonb as raw text by default — decode it to a Python
    # dict/list automatically everywhere it's read.
    await conn.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog", format="text"
    )


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        settings = get_settings()
        await init_schema(settings.database_url)
        _pool = await asyncpg.create_pool(
            settings.database_url, init=_init_connection, min_size=1, max_size=10
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def init_schema(database_url: str) -> None:
    """Applies any pending versioned migrations (see prisma/migrations/ and
    db/migrate.py's runner) — replaces what used to be ad hoc
    `CREATE TABLE IF NOT EXISTS` DDL run directly here on every boot.
    """
    await run_migrations(database_url)
