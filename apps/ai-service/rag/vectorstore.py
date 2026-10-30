from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import asyncpg


@dataclass
class VectorSearchResult:
    chunk_id: str
    document_id: str
    document_title: str
    doc_type: str
    content: str
    metadata: Dict[str, Any]
    score: float  # cosine similarity, higher is better


async def get_document_by_hash(pool: asyncpg.Pool, content_hash: str) -> Optional[asyncpg.Record]:
    async with pool.acquire() as conn:
        return await conn.fetchrow(
            "SELECT * FROM knowledge_documents WHERE content_hash = $1 AND deleted_at IS NULL",
            content_hash,
        )


async def upsert_document(
    pool: asyncpg.Pool,
    title: str,
    doc_type: str,
    source_filename: Optional[str],
    content_hash: str,
    content: str,
    metadata: Dict[str, Any],
    uploaded_by: Optional[str],
) -> Tuple[asyncpg.Record, bool]:
    """Callers should already have checked get_document_by_hash() for a
    dedup hit — the ON CONFLICT here is a backstop for the race between
    that check and this insert (two concurrent uploads of identical
    content), not the primary dedup path. Returns (row, was_inserted) so a
    caller can tell a fresh insert from the losing side of that race,
    which returns the winner's row instead of raising.
    """
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO knowledge_documents
                (title, doc_type, source_filename, content_hash, content, status, metadata, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, 'processing', $6::jsonb, $7)
            ON CONFLICT (content_hash) WHERE deleted_at IS NULL DO NOTHING
            RETURNING *
            """,
            title, doc_type, source_filename, content_hash, content, metadata, uploaded_by,
        )
        if row is not None:
            return row, True
        existing = await conn.fetchrow(
            "SELECT * FROM knowledge_documents WHERE content_hash = $1 AND deleted_at IS NULL",
            content_hash,
        )
        return existing, False


async def replace_chunks(
    pool: asyncpg.Pool,
    document_id: str,
    chunks: List[Dict[str, Any]],
    embedding_model: str,
) -> int:
    """Deletes any existing chunks for this document and inserts the new
    set — used for both first-time ingestion and reindexing.
    """
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM chunks WHERE document_id = $1", document_id)
            for idx, chunk in enumerate(chunks):
                await conn.execute(
                    """
                    INSERT INTO chunks (document_id, chunk_index, content, metadata, embedding)
                    VALUES ($1, $2, $3, $4::jsonb, $5)
                    """,
                    document_id, idx, chunk["text"], chunk.get("metadata", {}), chunk["embedding"],
                )
            await conn.execute(
                """
                UPDATE knowledge_documents
                SET status = 'indexed', chunk_count = $2, embedding_model = $3, updated_at = now()
                WHERE id = $1
                """,
                document_id, len(chunks), embedding_model,
            )
    return len(chunks)


async def mark_document_failed(pool: asyncpg.Pool, document_id: str, reason: str) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE knowledge_documents
            SET status = 'failed', metadata = metadata || jsonb_build_object('error', $2::text), updated_at = now()
            WHERE id = $1
            """,
            document_id, reason,
        )


async def mark_document_needs_ocr(pool: asyncpg.Pool, document_id: str, page_count: Optional[int]) -> None:
    """A PDF with no extractable text layer is not a failure — it just
    needs OCR this service doesn't perform. Distinct status so the admin UI
    (and any future OCR worker) can tell the two cases apart.
    """
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE knowledge_documents
            SET status = 'needs_ocr', metadata = metadata || jsonb_build_object('page_count', $2::int), updated_at = now()
            WHERE id = $1
            """,
            document_id, page_count,
        )


async def similarity_search(
    pool: asyncpg.Pool,
    query_embedding: List[float],
    top_k: int,
    doc_types: Optional[List[str]] = None,
) -> List[VectorSearchResult]:
    async with pool.acquire() as conn:
        if doc_types:
            rows = await conn.fetch(
                """
                SELECT c.id, c.document_id, c.content, c.metadata,
                       d.title AS document_title, d.doc_type,
                       1 - (c.embedding <=> $1) AS score
                FROM chunks c
                JOIN knowledge_documents d ON d.id = c.document_id
                WHERE d.status = 'indexed' AND d.deleted_at IS NULL AND d.doc_type = ANY($3::text[])
                ORDER BY c.embedding <=> $1
                LIMIT $2
                """,
                query_embedding, top_k, doc_types,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT c.id, c.document_id, c.content, c.metadata,
                       d.title AS document_title, d.doc_type,
                       1 - (c.embedding <=> $1) AS score
                FROM chunks c
                JOIN knowledge_documents d ON d.id = c.document_id
                WHERE d.status = 'indexed' AND d.deleted_at IS NULL
                ORDER BY c.embedding <=> $1
                LIMIT $2
                """,
                query_embedding, top_k,
            )

    return [
        VectorSearchResult(
            chunk_id=str(r["id"]),
            document_id=str(r["document_id"]),
            document_title=r["document_title"],
            doc_type=r["doc_type"],
            content=r["content"],
            metadata=r["metadata"] or {},
            score=float(r["score"]),
        )
        for r in rows
    ]


async def list_documents(pool: asyncpg.Pool) -> List[asyncpg.Record]:
    async with pool.acquire() as conn:
        return await conn.fetch(
            "SELECT * FROM knowledge_documents WHERE deleted_at IS NULL ORDER BY created_at DESC"
        )


async def list_categories(pool: asyncpg.Pool) -> List[asyncpg.Record]:
    async with pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT code, label, description, sort_order
            FROM knowledge_categories
            WHERE is_active = true
            ORDER BY sort_order, label
            """
        )


async def list_chunks_for_document(pool: asyncpg.Pool, document_id: str) -> List[asyncpg.Record]:
    async with pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT id, chunk_index, content, metadata
            FROM chunks
            WHERE document_id = $1
            ORDER BY chunk_index
            """,
            document_id,
        )


async def get_document(pool: asyncpg.Pool, document_id: str) -> Optional[asyncpg.Record]:
    async with pool.acquire() as conn:
        return await conn.fetchrow(
            "SELECT * FROM knowledge_documents WHERE id = $1 AND deleted_at IS NULL", document_id
        )


async def delete_document(pool: asyncpg.Pool, document_id: str, deleted_by: Optional[str] = None) -> bool:
    """Soft delete — the row (and its chunks) stay in place, just hidden
    from list/get/search, so an accidental delete is recoverable via
    restore_document(). `deleted_by` is None until a caller threads an
    admin identity through (see prisma/README.md's audit-fields note).
    """
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE knowledge_documents SET deleted_at = now(), deleted_by = $2 "
            "WHERE id = $1 AND deleted_at IS NULL",
            document_id, deleted_by,
        )
    return result.endswith(" 1")


async def restore_document(pool: asyncpg.Pool, document_id: str) -> bool:
    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE knowledge_documents SET deleted_at = NULL, deleted_by = NULL "
            "WHERE id = $1 AND deleted_at IS NOT NULL",
            document_id,
        )
    return result.endswith(" 1")


async def keyword_search(pool: asyncpg.Pool, query: str, top_k: int = 20) -> List[asyncpg.Record]:
    """Full-text search over knowledge_documents (title + content), backing
    GET /knowledge/status?q=... — an admin search box, independent of
    pgvector similarity search (which operates on chunks, not documents).
    """
    async with pool.acquire() as conn:
        return await conn.fetch(
            """
            SELECT *, ts_rank(search_vector, plainto_tsquery('english', $1)) AS rank
            FROM knowledge_documents
            WHERE deleted_at IS NULL AND search_vector @@ plainto_tsquery('english', $1)
            ORDER BY rank DESC, created_at DESC
            LIMIT $2
            """,
            query, top_k,
        )


async def log_document_event(
    pool: asyncpg.Pool,
    document_id: str,
    event_type: str,
    detail: Optional[Dict[str, Any]] = None,
    actor: Optional[str] = None,
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO knowledge_document_events (document_id, event_type, detail, actor)
            VALUES ($1, $2, $3::jsonb, $4)
            """,
            document_id, event_type, detail or {}, actor,
        )


async def log_retrieval(
    pool: asyncpg.Pool,
    session_id: Optional[str],
    query: str,
    intent: str,
    retrieved_chunk_ids: List[str],
    scores: Dict[str, float],
    confidence_score: float,
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO retrieval_logs
                (session_id, query, intent, retrieved_chunk_ids, scores, confidence_score)
            VALUES ($1, $2, $3, $4::uuid[], $5::jsonb, $6)
            """,
            session_id, query, intent, retrieved_chunk_ids, scores, confidence_score,
        )
