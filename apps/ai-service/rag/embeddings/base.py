from abc import ABC, abstractmethod
from typing import List


class EmbeddingProvider(ABC):
    """Turns text into fixed-dimension vectors. Every implementation must
    emit vectors of the same dimension (config.Settings.embedding_dim) so
    the pgvector column never needs to change when the provider is swapped.
    """

    name: str = "base"
    dimension: int = 1536

    @abstractmethod
    async def embed(self, texts: List[str]) -> List[List[float]]:
        """Returns one embedding vector per input text, same order."""
        raise NotImplementedError

    async def embed_one(self, text: str) -> List[float]:
        return (await self.embed([text]))[0]
