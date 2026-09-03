import re
from dataclasses import dataclass
from typing import Dict, List

from .vectorstore import VectorSearchResult

_TOKEN_RE = re.compile(r"[a-z0-9]+")

_STOPWORDS = {
    "the", "a", "an", "is", "are", "of", "for", "in", "on", "to", "and",
    "or", "what", "which", "how", "do", "does", "i", "my", "me", "with",
}


@dataclass
class RankedChunk:
    result: VectorSearchResult
    vector_score: float
    keyword_score: float
    doc_type_boost: float
    final_score: float


def _tokenize(text: str) -> set:
    return {t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOPWORDS}


def _keyword_overlap(query_tokens: set, content: str) -> float:
    if not query_tokens:
        return 0.0
    content_tokens = _tokenize(content)
    if not content_tokens:
        return 0.0
    overlap = len(query_tokens & content_tokens)
    return overlap / len(query_tokens)


def rerank(
    query: str,
    results: List[VectorSearchResult],
    preferred_doc_types: List[str],
    top_n: int,
    vector_weight: float = 0.6,
    keyword_weight: float = 0.3,
    doc_type_weight: float = 0.1,
) -> List[RankedChunk]:
    """Hybrid reranking: fuses the pgvector cosine-similarity score with
    lexical keyword overlap and a soft boost for knowledge-doc types the
    detected intent prefers. This compensates for the local hash embedding
    provider's weak semantics (see local_hash_embeddings.py) and, even
    with a real embedding model, hybrid scoring is standard practice for
    short, keyword-heavy admissions queries ("RVCE CSE cutoff KCET 2025").
    """
    query_tokens = _tokenize(query)
    ranked: List[RankedChunk] = []

    for r in results:
        keyword_score = _keyword_overlap(query_tokens, r.content)
        doc_type_boost = 1.0 if r.doc_type in preferred_doc_types else 0.0
        final = (
            vector_weight * max(r.score, 0.0)
            + keyword_weight * keyword_score
            + doc_type_weight * doc_type_boost
        )
        ranked.append(
            RankedChunk(
                result=r,
                vector_score=r.score,
                keyword_score=keyword_score,
                doc_type_boost=doc_type_boost,
                final_score=final,
            )
        )

    ranked.sort(key=lambda c: c.final_score, reverse=True)
    return ranked[:top_n]
