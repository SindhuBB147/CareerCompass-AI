from config import Settings

from .base import LLMProvider
from .fallback_provider import FallbackTemplateProvider
from .gemini_provider import GeminiProvider
from .ollama_provider import OllamaProvider
from .openai_provider import OpenAiProvider


def build_llm_provider(settings: Settings) -> LLMProvider:
    provider = settings.llm_provider

    if provider == "azure_openai" and settings.azure_openai_api_key and settings.azure_openai_endpoint:
        return OpenAiProvider(
            api_key=settings.azure_openai_api_key,
            model=settings.azure_openai_deployment or settings.openai_model,
            base_url=settings.azure_openai_endpoint.rstrip("/"),
            api_version=settings.azure_openai_api_version,
            is_azure=True,
        )

    if provider == "openai" and settings.openai_api_key:
        return OpenAiProvider(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            base_url=settings.openai_base_url,
        )

    if provider == "gemini" and settings.gemini_api_key:
        return GeminiProvider(api_key=settings.gemini_api_key, model=settings.gemini_model)

    if provider == "ollama":
        return OllamaProvider(base_url=settings.ollama_base_url, model=settings.ollama_model)

    # "fallback" or any unrecognized/unconfigured value — always available,
    # zero external dependencies, still strictly grounded in retrieved context.
    return FallbackTemplateProvider()
