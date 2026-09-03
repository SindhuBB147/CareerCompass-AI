from dataclasses import dataclass
from typing import List

import asyncpg

from config import Settings
from rag.embeddings.base import EmbeddingProvider
from rag.intent import INTENT_DOC_TYPE_HINTS, IntentResult
from rag.reranker import rerank
from rag.vectorstore import VectorSearchResult, similarity_search
from schemas import StructuredContextItem


@dataclass
class RetrievedItem:
    tag: str  # "S1", "S2", ... — referenced by the LLM's citations
    source_type: str  # college | cutoff | scholarship | prediction | financial | roadmap | exam | document
    source_id: str
    title: str
    content: str
    score: float


@dataclass
class RetrievalResult:
    items: List[RetrievedItem]
    vector_matches: List[VectorSearchResult]  # raw, for retrieval_logs


async def retrieve(
    pool: asyncpg.Pool,
    embedding_provider: EmbeddingProvider,
    settings: Settings,
    query: str,
    intent_result: IntentResult,
    structured_context: List[StructuredContextItem],
) -> RetrievalResult:
    """Retrieval-Augmented Generation's "R": vector search over the
    document knowledge base, hybrid-reranked, merged with the structured
    platform data Nest already fetched for this student. Structured
    context is always authoritative (it came from the platform's own
    repositories, not a similarity guess) and is placed first so the LLM
    sees it before less-certain document chunks.
    """
    items: List[RetrievedItem] = []
    tag_idx = 1

    for sc in structured_context:
        items.append(
            RetrievedItem(
                tag=f"S{tag_idx}",
                source_type=sc.type,
                source_id=sc.id,
                title=sc.title,
                content=sc.content,
                score=1.0,
            )
        )
        tag_idx += 1

    query_embedding = await embedding_provider.embed_one(intent_result.expanded_query)
    vector_matches = await similarity_search(
        pool, query_embedding, top_k=settings.retrieval_top_k
    )

    preferred_doc_types = INTENT_DOC_TYPE_HINTS.get(intent_result.primary, [])
    ranked = rerank(query, vector_matches, preferred_doc_types, top_n=settings.rerank_top_n)

    for chunk in ranked:
        items.append(
            RetrievedItem(
                tag=f"S{tag_idx}",
                source_type="document",
                source_id=chunk.result.chunk_id,
                title=chunk.result.document_title,
                content=chunk.result.content,
                score=chunk.final_score,
            )
        )
        tag_idx += 1

    return RetrievalResult(items=items, vector_matches=vector_matches)
