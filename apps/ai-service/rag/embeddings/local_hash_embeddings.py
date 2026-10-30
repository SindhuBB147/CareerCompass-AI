import hashlib
import math
import re
from typing import List

from .base import EmbeddingProvider

_TOKEN_RE = re.compile(r"[a-z0-9]+")


class LocalHashEmbeddingProvider(EmbeddingProvider):
    """Deterministic, dependency-free embedding provider.

    Uses signed feature hashing (the "hashing trick"): each token is hashed
    into one of `dimension` buckets and accumulated with a sign derived from
    a second hash, then L2-normalized. This is not a learned embedding, so
    semantic recall is weaker than a real model — retrieval quality is
    recovered downstream via hybrid reranking (rag/reranker.py) that fuses
    this vector score with lexical overlap. Its purpose is to keep the
    entire RAG pipeline runnable with zero external services or API keys.
    """

    name = "local_hash"

    def __init__(self, dimension: int = 1536):
        self.dimension = dimension

    async def embed(self, texts: List[str]) -> List[List[float]]:
        return [self._embed_one(t) for t in texts]

    def _embed_one(self, text: str) -> List[float]:
        vec = [0.0] * self.dimension
        tokens = _TOKEN_RE.findall(text.lower())
        for tok in tokens:
            bucket_digest = hashlib.md5(tok.encode("utf-8")).digest()
            bucket = int.from_bytes(bucket_digest[:4], "little") % self.dimension
            sign_digest = hashlib.md5((tok + "_sign").encode("utf-8")).digest()
            sign = 1.0 if sign_digest[0] % 2 == 0 else -1.0
            vec[bucket] += sign

        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec
