import json

import asyncpg
from pgvector.asyncpg import register_vector

from config import get_settings

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
        _pool = await asyncpg.create_pool(
            settings.database_url, init=_init_connection, min_size=1, max_size=10
        )
        await init_schema(_pool)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def init_schema(pool: asyncpg.Pool) -> None:
    """Creates the vector-store schema if it doesn't already exist.

    Embedding dimension is baked into the column type at creation time —
    all providers (OpenAI, local fallback, etc.) are made to emit vectors
    of this same fixed size so switching providers never requires a
    migration.
    """
    settings = get_settings()
    dim = settings.embedding_dim

    async with pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS knowledge_documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title TEXT NOT NULL,
                doc_type TEXT NOT NULL DEFAULT 'general',
                source_filename TEXT,
                content_hash TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'processing',
                chunk_count INT NOT NULL DEFAULT 0,
                embedding_model TEXT,
                metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                uploaded_by TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        # Safety net for a DB created before the `content` column existed.
        await conn.execute(
            "ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT ''"
        )
        await conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS chunks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
                chunk_index INT NOT NULL,
                content TEXT NOT NULL,
                metadata JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                embedding vector({dim}) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id)"
        )
        # ivfflat needs at least one row to build meaningfully; IF NOT EXISTS
        # makes this safe to run repeatedly (and on an empty table) at boot.
        await conn.execute(
            """
            CREATE INDEX IF NOT EXISTS chunks_embedding_idx
            ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
            """
        )
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS prompt_templates (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL UNIQUE,
                version INT NOT NULL DEFAULT 1,
                system_prompt TEXT NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS retrieval_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id TEXT,
                query TEXT NOT NULL,
                intent TEXT,
                retrieved_chunk_ids UUID[] NOT NULL DEFAULT '{}',
                scores JSONB NOT NULL DEFAULT '{}'::jsonb,
                confidence_score DOUBLE PRECISION,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
