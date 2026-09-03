from config import Settings

from .base import EmbeddingProvider
from .local_hash_embeddings import LocalHashEmbeddingProvider
from .ollama_embeddings import OllamaEmbeddingProvider
from .openai_embeddings import OpenAiEmbeddingProvider


def build_embedding_provider(settings: Settings) -> EmbeddingProvider:
    provider = settings.embedding_provider

    if provider == "openai" and settings.openai_api_key:
        return OpenAiEmbeddingProvider(
            api_key=settings.openai_api_key,
            model=settings.openai_embedding_model,
            dimension=settings.embedding_dim,
            base_url=settings.openai_base_url,
        )

    if provider == "ollama":
        return OllamaEmbeddingProvider(
            base_url=settings.ollama_base_url,
            model=settings.ollama_embedding_model,
            dimension=settings.embedding_dim,
        )

    # "local" or any unrecognized/unconfigured value — always available,
    # zero external dependencies.
    return LocalHashEmbeddingProvider(dimension=settings.embedding_dim)
