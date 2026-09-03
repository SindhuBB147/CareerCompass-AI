import hashlib
import io
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional

import asyncpg

from config import Settings
from rag.chunker import TextChunker
from rag.embeddings.base import EmbeddingProvider
from rag.vectorstore import (
    get_document,
    get_document_by_hash,
    list_documents,
    mark_document_failed,
    replace_chunks,
    upsert_document,
)

_INJECTION_PATTERNS = [
    r"ignore (all|any|previous|prior) instructions",
    r"disregard (all|any|previous|prior) instructions",
    r"you are now",
    r"system\s*:\s*",
    r"reveal (the|your) (system )?prompt",
    r"act as (if|though)",
]
_INJECTION_RE = re.compile("|".join(_INJECTION_PATTERNS), re.IGNORECASE)


@dataclass
class IngestOutcome:
    document_id: str
    title: str
    status: str
    chunk_count: int
    reused_existing: bool


def extract_text(filename: str, raw_bytes: bytes) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return _extract_pdf(raw_bytes)
    if lower.endswith(".docx"):
        return _extract_docx(raw_bytes)
    # .txt and anything else — best-effort decode
    return raw_bytes.decode("utf-8", errors="ignore")


def _extract_pdf(raw_bytes: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(raw_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(pages)


def _extract_docx(raw_bytes: bytes) -> str:
    import docx

    document = docx.Document(io.BytesIO(raw_bytes))
    return "\n\n".join(p.text for p in document.paragraphs if p.text.strip())


def clean_text(text: str) -> str:
    normalized = text.replace("\x00", "").replace("\r\n", "\n")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def compute_content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def flag_injection_attempts(text: str) -> bool:
    return bool(_INJECTION_RE.search(text))


async def ingest_document(
    pool: asyncpg.Pool,
    embedding_provider: EmbeddingProvider,
    settings: Settings,
    title: str,
    doc_type: str,
    filename: Optional[str],
    raw_bytes: bytes,
    uploaded_by: Optional[str],
) -> IngestOutcome:
    """Full pipeline: extract -> clean -> hash -> (skip if unchanged) ->
    chunk -> embed -> store. Content-hash dedup makes re-uploading an
    unchanged document a no-op, and re-uploading a changed document under
    the same title automatically reindexes it.
    """
    raw_text = extract_text(filename or title, raw_bytes)
    cleaned = clean_text(raw_text)
    content_hash = compute_content_hash(cleaned)

    existing = await get_document_by_hash(pool, content_hash)
    if existing is not None:
        return IngestOutcome(
            document_id=str(existing["id"]),
            title=existing["title"],
            status=existing["status"],
            chunk_count=existing["chunk_count"],
            reused_existing=True,
        )

    metadata: Dict[str, Any] = {
        "injection_flagged": flag_injection_attempts(cleaned),
        "char_count": len(cleaned),
    }

    doc_row = await upsert_document(
        pool, title=title, doc_type=doc_type, source_filename=filename,
        content_hash=content_hash, content=cleaned, metadata=metadata, uploaded_by=uploaded_by,
    )
    document_id = str(doc_row["id"])

    outcome = await _chunk_embed_store(pool, embedding_provider, settings, document_id, title, cleaned)
    return outcome


async def reindex_document(
    pool: asyncpg.Pool, embedding_provider: EmbeddingProvider, settings: Settings, document_id: str
) -> Optional[IngestOutcome]:
    """Rebuilds chunks + embeddings for an already-ingested document from
    its stored cleaned text — no re-upload needed. Used for both the admin
    "Rebuild Embeddings" action and after an embedding provider change.
    """
    doc_row = await get_document(pool, document_id)
    if doc_row is None:
        return None
    return await _chunk_embed_store(
        pool, embedding_provider, settings, document_id, doc_row["title"], doc_row["content"]
    )


async def reindex_all(pool: asyncpg.Pool, embedding_provider: EmbeddingProvider, settings: Settings) -> IngestOutcome:
    documents = await list_documents(pool)
    total_chunks = 0
    for doc_row in documents:
        outcome = await _chunk_embed_store(
            pool, embedding_provider, settings, str(doc_row["id"]), doc_row["title"], doc_row["content"]
        )
        total_chunks += outcome.chunk_count
    return IngestOutcome(
        document_id="*", title="all documents", status="indexed",
        chunk_count=total_chunks, reused_existing=False,
    )


async def _chunk_embed_store(
    pool: asyncpg.Pool,
    embedding_provider: EmbeddingProvider,
    settings: Settings,
    document_id: str,
    title: str,
    cleaned_text: str,
) -> IngestOutcome:
    chunker = TextChunker(
        chunk_size=settings.chunk_size_words, chunk_overlap=settings.chunk_overlap_words
    )
    raw_chunks = chunker.chunk_text(cleaned_text, metadata={"document_id": document_id, "title": title})

    if not raw_chunks:
        await mark_document_failed(pool, document_id, "No extractable text content")
        return IngestOutcome(document_id=document_id, title=title, status="failed", chunk_count=0, reused_existing=False)

    try:
        embeddings = await embedding_provider.embed([c["text"] for c in raw_chunks])
    except Exception as exc:  # noqa: BLE001 — surface as a failed document, not a 500
        await mark_document_failed(pool, document_id, f"Embedding failed: {exc}")
        return IngestOutcome(document_id=document_id, title=title, status="failed", chunk_count=0, reused_existing=False)

    for chunk, embedding in zip(raw_chunks, embeddings):
        chunk["embedding"] = embedding

    chunk_count = await replace_chunks(pool, document_id, raw_chunks, embedding_model=embedding_provider.name)

    return IngestOutcome(
        document_id=document_id, title=title, status="indexed",
        chunk_count=chunk_count, reused_existing=False,
    )
