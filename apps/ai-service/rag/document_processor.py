import csv
import hashlib
import io
import json
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import asyncpg

from config import Settings
from rag.chunker import TextChunker
from rag.embeddings.base import EmbeddingProvider
from rag.vectorstore import (
    get_document,
    get_document_by_hash,
    list_documents,
    log_document_event,
    mark_document_failed,
    mark_document_needs_ocr,
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


@dataclass
class ExtractionMeta:
    """Signal from extraction that doesn't belong in the text itself.

    ``likely_scanned`` distinguishes "this PDF has no text layer" (needs
    OCR this service doesn't perform) from a genuine empty/corrupt file —
    see _extract_pdf. Only PDFs ever set page_count/likely_scanned; other
    formats have no page concept and leave both at their defaults.
    """

    likely_scanned: bool = False
    page_count: Optional[int] = None


# A page with fewer than this many characters of extracted text doesn't
# count as "has a text layer" — small enough to not misclassify a mostly-
# blank real page, large enough that pypdf's whitespace-only leftovers
# from an image-only scan don't count either.
_MIN_PAGE_TEXT_CHARS = 20


def extract_text(filename: str, raw_bytes: bytes) -> Tuple[str, ExtractionMeta]:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return _extract_pdf(raw_bytes)
    if lower.endswith(".docx"):
        return _extract_docx(raw_bytes)
    if lower.endswith(".csv"):
        return _extract_csv(raw_bytes)
    if lower.endswith(".json"):
        return _extract_json(raw_bytes)
    # .txt and anything else — best-effort decode
    return raw_bytes.decode("utf-8", errors="ignore"), ExtractionMeta()


def _extract_pdf(raw_bytes: bytes) -> Tuple[str, ExtractionMeta]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(raw_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    page_count = len(pages)
    pages_with_text = sum(1 for p in pages if len(p.strip()) >= _MIN_PAGE_TEXT_CHARS)
    likely_scanned = page_count > 0 and pages_with_text == 0

    # Prefix each page with a sentinel paragraph the chunker recognizes
    # (rag/chunker.py) so chunks can carry a real page number. This bakes
    # into the stored `content`, so reindexing from stored content keeps
    # page numbers without needing the original PDF bytes again.
    marked = [f"[[PAGE:{i + 1}]]\n\n{text}" for i, text in enumerate(pages)]
    return "\n\n".join(marked), ExtractionMeta(likely_scanned=likely_scanned, page_count=page_count)


def _extract_docx(raw_bytes: bytes) -> Tuple[str, ExtractionMeta]:
    import docx

    document = docx.Document(io.BytesIO(raw_bytes))
    text = "\n\n".join(p.text for p in document.paragraphs if p.text.strip())
    return text, ExtractionMeta()


def _extract_csv(raw_bytes: bytes) -> Tuple[str, ExtractionMeta]:
    """One paragraph per row (`col: val` lines) so the chunker's paragraph
    packing never splits a row's fields apart — a college/course/seats row
    stays a single coherent unit.
    """
    text = raw_bytes.decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    paragraphs: List[str] = []
    for row in reader:
        lines = [f"{k}: {v}" for k, v in row.items() if k and str(v).strip()]
        if lines:
            paragraphs.append("\n".join(lines))
    return "\n\n".join(paragraphs), ExtractionMeta()


def _extract_json(raw_bytes: bytes) -> Tuple[str, ExtractionMeta]:
    """One paragraph per top-level record (list) or the whole object
    (single object), so a logical record is never split mid-way by the
    chunker. Nested values are compact-JSON-stringified rather than
    recursively flattened, to preserve their structure without inventing
    a flattening scheme the source data didn't have.
    """
    try:
        data = json.loads(raw_bytes.decode("utf-8", errors="ignore"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return "", ExtractionMeta()

    records = data if isinstance(data, list) else [data]
    paragraphs: List[str] = []
    for record in records:
        if isinstance(record, dict):
            lines = [f"{k}: {_stringify(v)}" for k, v in record.items()]
            paragraphs.append("\n".join(lines))
        else:
            paragraphs.append(_stringify(record))
    return "\n\n".join(paragraphs), ExtractionMeta()


def _stringify(value: Any) -> str:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


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
    raw_text, extraction_meta = extract_text(filename or title, raw_bytes)
    cleaned = clean_text(raw_text)
    content_hash = compute_content_hash(cleaned)

    existing = await get_document_by_hash(pool, content_hash)
    if existing is not None:
        await log_document_event(
            pool, str(existing["id"]), "reused_duplicate", detail={"content_hash": content_hash}
        )
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
    if extraction_meta.page_count is not None:
        metadata["page_count"] = extraction_meta.page_count

    doc_row, was_inserted = await upsert_document(
        pool, title=title, doc_type=doc_type, source_filename=filename,
        content_hash=content_hash, content=cleaned, metadata=metadata, uploaded_by=uploaded_by,
    )
    document_id = str(doc_row["id"])

    if not was_inserted:
        # Lost a race against a concurrent upload of identical content —
        # same outcome as the get_document_by_hash() dedup hit above.
        await log_document_event(
            pool, document_id, "reused_duplicate", detail={"content_hash": content_hash}
        )
        return IngestOutcome(
            document_id=document_id, title=doc_row["title"], status=doc_row["status"],
            chunk_count=doc_row["chunk_count"], reused_existing=True,
        )

    await log_document_event(
        pool, document_id, "uploaded", detail={"filename": filename, "doc_type": doc_type}, actor=uploaded_by
    )

    outcome = await _chunk_embed_store(
        pool, embedding_provider, settings, document_id, title, cleaned,
        likely_scanned=extraction_meta.likely_scanned,
    )
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
    outcome = await _chunk_embed_store(
        pool, embedding_provider, settings, document_id, doc_row["title"], doc_row["content"],
        # No raw bytes to re-detect from — trust the document's current
        # status rather than flapping an already-flagged doc back to 'failed'.
        likely_scanned=doc_row["status"] == "needs_ocr",
    )
    if outcome.status == "indexed":
        await log_document_event(pool, document_id, "reindexed", detail={"chunk_count": outcome.chunk_count})
    return outcome


async def reindex_all(pool: asyncpg.Pool, embedding_provider: EmbeddingProvider, settings: Settings) -> IngestOutcome:
    documents = await list_documents(pool)
    total_chunks = 0
    for doc_row in documents:
        doc_id = str(doc_row["id"])
        outcome = await _chunk_embed_store(
            pool, embedding_provider, settings, doc_id, doc_row["title"], doc_row["content"],
            likely_scanned=doc_row["status"] == "needs_ocr",
        )
        if outcome.status == "indexed":
            await log_document_event(pool, doc_id, "reindexed", detail={"chunk_count": outcome.chunk_count})
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
    likely_scanned: bool = False,
) -> IngestOutcome:
    chunker = TextChunker(
        chunk_size=settings.chunk_size_words, chunk_overlap=settings.chunk_overlap_words
    )
    raw_chunks = chunker.chunk_text(cleaned_text, metadata={"document_id": document_id, "title": title})

    if not raw_chunks:
        if likely_scanned:
            await mark_document_needs_ocr(pool, document_id, page_count=None)
            await log_document_event(pool, document_id, "needs_ocr", detail={"reason": "No text layer detected (likely a scanned PDF)"})
            return IngestOutcome(document_id=document_id, title=title, status="needs_ocr", chunk_count=0, reused_existing=False)
        reason = "No extractable text content"
        await mark_document_failed(pool, document_id, reason)
        await log_document_event(pool, document_id, "failed", detail={"reason": reason})
        return IngestOutcome(document_id=document_id, title=title, status="failed", chunk_count=0, reused_existing=False)

    try:
        embeddings = await embedding_provider.embed([c["text"] for c in raw_chunks])
    except Exception as exc:  # noqa: BLE001 — surface as a failed document, not a 500
        reason = f"Embedding failed: {exc}"
        await mark_document_failed(pool, document_id, reason)
        await log_document_event(pool, document_id, "failed", detail={"reason": reason})
        return IngestOutcome(document_id=document_id, title=title, status="failed", chunk_count=0, reused_existing=False)

    for chunk, embedding in zip(raw_chunks, embeddings):
        chunk["embedding"] = embedding

    chunk_count = await replace_chunks(pool, document_id, raw_chunks, embedding_model=embedding_provider.name)

    return IngestOutcome(
        document_id=document_id, title=title, status="indexed",
        chunk_count=chunk_count, reused_existing=False,
    )
