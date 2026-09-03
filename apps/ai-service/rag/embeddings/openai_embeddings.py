from typing import List

import httpx

from .base import EmbeddingProvider


class OpenAiEmbeddingProvider(EmbeddingProvider):
    """Real embeddings via the OpenAI Embeddings API (also works against an
    Azure OpenAI embeddings deployment if `base_url` is pointed there).
    """

    name = "openai"

    def __init__(
        self,
        api_key: str,
        model: str = "text-embedding-3-small",
        dimension: int = 1536,
        base_url: str | None = None,
    ):
        self.api_key = api_key
        self.model = model
        self.dimension = dimension
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/")

    async def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/embeddings",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "input": texts, "dimensions": self.dimension},
            )
            resp.raise_for_status()
            data = resp.json()
        by_index = sorted(data["data"], key=lambda d: d["index"])
        return [d["embedding"] for d in by_index]
