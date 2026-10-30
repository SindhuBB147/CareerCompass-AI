import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _env_bool(key: str, default: bool = False) -> bool:
    val = os.getenv(key)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    """Central configuration, read from environment variables (.env in dev).

    Provider selection is auto-detected when not explicitly set: if an API
    key for a given provider is present, that provider becomes the default;
    otherwise the deterministic offline fallback provider is used so the
    pipeline always runs end-to-end with zero external dependencies.
    """

    def __init__(self) -> None:
        # ── Postgres / pgvector ──────────────────────────────────────────
        self.database_url = os.getenv(
            "DATABASE_URL", "postgresql://localhost:5432/career_compass_rag"
        )
        self.embedding_dim = int(os.getenv("EMBEDDING_DIM", "1536"))

        # ── Service-to-service auth ──────────────────────────────────────
        self.internal_token = os.getenv("AI_SERVICE_INTERNAL_TOKEN") or None

        # ── LLM provider ──────────────────────────────────────────────────
        self.openai_api_key = os.getenv("OPENAI_API_KEY") or None
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.openai_base_url = os.getenv("OPENAI_BASE_URL") or None
        self.openai_embedding_model = os.getenv(
            "OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"
        )

        self.azure_openai_api_key = os.getenv("AZURE_OPENAI_API_KEY") or None
        self.azure_openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT") or None
        self.azure_openai_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT") or None
        self.azure_openai_api_version = os.getenv(
            "AZURE_OPENAI_API_VERSION", "2024-06-01"
        )

        self.gemini_api_key = os.getenv("GEMINI_API_KEY") or None
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "llama3.1")
        self.ollama_embedding_model = os.getenv(
            "OLLAMA_EMBEDDING_MODEL", "nomic-embed-text"
        )

        self.llm_provider = os.getenv("LLM_PROVIDER") or self._auto_llm_provider()
        self.embedding_provider = (
            os.getenv("EMBEDDING_PROVIDER") or self._auto_embedding_provider()
        )

        # ── RAG pipeline tuning ───────────────────────────────────────────
        self.chunk_size_words = int(os.getenv("CHUNK_SIZE_WORDS", "300"))
        self.chunk_overlap_words = int(os.getenv("CHUNK_OVERLAP_WORDS", "50"))
        self.retrieval_top_k = int(os.getenv("RETRIEVAL_TOP_K", "8"))
        self.rerank_top_n = int(os.getenv("RERANK_TOP_N", "5"))
        self.max_upload_mb = int(os.getenv("MAX_UPLOAD_MB", "10"))
        self.max_history_turns = int(os.getenv("MAX_HISTORY_TURNS", "6"))

    def _auto_llm_provider(self) -> str:
        if os.getenv("AZURE_OPENAI_API_KEY") and os.getenv("AZURE_OPENAI_ENDPOINT"):
            return "azure_openai"
        if os.getenv("OPENAI_API_KEY"):
            return "openai"
        if os.getenv("GEMINI_API_KEY"):
            return "gemini"
        if _env_bool("USE_OLLAMA"):
            return "ollama"
        return "fallback"

    def _auto_embedding_provider(self) -> str:
        if os.getenv("OPENAI_API_KEY"):
            return "openai"
        if _env_bool("USE_OLLAMA"):
            return "ollama"
        return "local"


@lru_cache
def get_settings() -> Settings:
    return Settings()
