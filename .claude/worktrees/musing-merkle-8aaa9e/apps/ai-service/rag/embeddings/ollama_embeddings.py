from typing import List

import httpx

from .base import EmbeddingProvider


class OllamaEmbeddingProvider(EmbeddingProvider):
    """Embeddings from a locally-running Ollama instance. Ollama returns
    whatever dimension the underlying model produces (e.g. 768 for
    nomic-embed-text) — since the pgvector column is fixed at
    `dimension`, vectors are truncated or zero-padded to fit. This keeps
    the schema stable across providers at the cost of some precision if
    the model's native dimension differs from the configured one.
    """

    name = "ollama"

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "nomic-embed-text",
        dimension: int = 1536,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.dimension = dimension

    async def embed(self, texts: List[str]) -> List[List[float]]:
        results: List[List[float]] = []
        async with httpx.AsyncClient(timeout=60.0) as client:
            for text in texts:
                resp = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": self.model, "prompt": text},
                )
                resp.raise_for_status()
                vec = resp.json()["embedding"]
                results.append(self._fit_dimension(vec))
        return results

    def _fit_dimension(self, vec: List[float]) -> List[float]:
        if len(vec) == self.dimension:
            return vec
        if len(vec) > self.dimension:
            return vec[: self.dimension]
        return vec + [0.0] * (self.dimension - len(vec))
