from config import Settings

from .base import LLMProvider
from .fallback_provider import FallbackTemplateProvider
from .gemini_provider import GeminiProvider
from .ollama_provider import OllamaProvider
from .openai_provider import OpenAiProvider

# Providers considered "configured" (credentials present) vs. "fallback",
# which is always available. Shared by build_llm_provider and
# rag/llm/provider_resolver.py (the admin live-switch feature) so both agree
# on what's actually usable — see is_provider_configured().
KNOWN_PROVIDERS = ("azure_openai", "openai", "gemini", "ollama", "fallback")


def is_provider_configured(provider: str, settings: Settings) -> bool:
    if provider == "azure_openai":
        return bool(settings.azure_openai_api_key and settings.azure_openai_endpoint)
    if provider == "openai":
        return bool(settings.openai_api_key)
    if provider == "gemini":
        return bool(settings.gemini_api_key)
    if provider == "ollama":
        # No API key by design (locally-hosted) — treated as always
        # "configured" so it can be selected; if Ollama isn't actually
        # running, requests fail at call time like any other network error.
        return True
    if provider == "fallback":
        return True
    return False


def configured_providers(settings: Settings) -> list:
    return [p for p in KNOWN_PROVIDERS if is_provider_configured(p, settings)]


def instantiate_llm_provider(provider: str, settings: Settings) -> LLMProvider:
    """Builds a concrete provider instance for an already-validated,
    configured `provider` name. Does not fall back — callers decide the
    fallback policy (build_llm_provider falls back to "fallback" on an
    unconfigured/unrecognized name; provider_resolver.py rejects an
    unconfigured override outright instead of silently substituting).
    """
    if provider == "azure_openai":
        return OpenAiProvider(
            api_key=settings.azure_openai_api_key,
            model=settings.azure_openai_deployment or settings.openai_model,
            base_url=settings.azure_openai_endpoint.rstrip("/"),
            api_version=settings.azure_openai_api_version,
            is_azure=True,
        )
    if provider == "openai":
        return OpenAiProvider(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            base_url=settings.openai_base_url,
        )
    if provider == "gemini":
        return GeminiProvider(api_key=settings.gemini_api_key, model=settings.gemini_model)
    if provider == "ollama":
        return OllamaProvider(base_url=settings.ollama_base_url, model=settings.ollama_model)
    return FallbackTemplateProvider()


def build_llm_provider(settings: Settings) -> LLMProvider:
    provider = settings.llm_provider
    if provider in KNOWN_PROVIDERS and is_provider_configured(provider, settings):
        return instantiate_llm_provider(provider, settings)

    # Unrecognized/unconfigured value — always available, zero external
    # dependencies, still strictly grounded in retrieved context.
    return FallbackTemplateProvider()
