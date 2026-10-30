from dataclasses import dataclass
from typing import Any, Dict, List, Optional

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
            "SELECT * FROM knowledge_documents WHERE content_hash = $1", content_hash
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
) -> asyncpg.Record:
    async with pool.acquire() as conn:
        return await conn.fetchrow(
            """
            INSERT INTO knowledge_documents
                (title, doc_type, source_filename, content_hash, content, status, metadata, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, 'processing', $6::jsonb, $7)
            RETURNING *
            """,
            title, doc_type, source_filename, content_hash, content, metadata, uploaded_by,
        )


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
                WHERE d.status = 'indexed' AND d.doc_type = ANY($3::text[])
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
                WHERE d.status = 'indexed'
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
            "SELECT * FROM knowledge_documents ORDER BY created_at DESC"
        )


async def get_document(pool: asyncpg.Pool, document_id: str) -> Optional[asyncpg.Record]:
    async with pool.acquire() as conn:
        return await conn.fetchrow("SELECT * FROM knowledge_documents WHERE id = $1", document_id)


async def delete_document(pool: asyncpg.Pool, document_id: str) -> bool:
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM knowledge_documents WHERE id = $1", document_id)
    return result.endswith("1")


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
