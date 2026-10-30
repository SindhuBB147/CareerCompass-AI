from dataclasses import dataclass
from typing import Optional

import pytest

from rag.llm.fallback_provider import FallbackTemplateProvider
from rag.llm.gemini_provider import GeminiProvider
from rag.llm.provider_resolver import (
    UnconfiguredProviderError,
    get_llm_provider_settings,
    get_provider_override,
    resolve_llm_provider,
    set_provider_override,
)
import rag.llm.provider_resolver as provider_resolver_module


@dataclass
class FakeSettings:
    """Minimal stand-in for config.Settings — deliberately independent of
    the real .env (which may have real provider keys configured on a given
    machine) so these tests are deterministic regardless of environment.
    """
    llm_provider: str = "fallback"
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    openai_base_url: Optional[str] = None
    azure_openai_api_key: Optional[str] = None
    azure_openai_endpoint: Optional[str] = None
    azure_openai_deployment: Optional[str] = None
    azure_openai_api_version: str = "2024-06-01"
    gemini_api_key: Optional[str] = "gm-configured"
    gemini_model: str = "gemini-1.5-flash"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"


@pytest.fixture(autouse=True)
def reset_provider_cache():
    """The resolver caches the override in-process for ~30s (see
    provider_resolver.py) so a lightly-loaded chat endpoint isn't hitting
    Postgres every request — but that means state can leak between tests
    unless it's reset each time.
    """
    provider_resolver_module._cache["value"] = None
    provider_resolver_module._cache["fetched_at"] = 0.0
    yield
    provider_resolver_module._cache["value"] = None
    provider_resolver_module._cache["fetched_at"] = 0.0


async def test_no_override_resolves_to_env_default(pool):
    settings = FakeSettings(llm_provider="gemini")
    provider = await resolve_llm_provider(pool, settings)
    assert isinstance(provider, GeminiProvider)


async def test_set_override_to_configured_provider_is_honored(pool):
    settings = FakeSettings(llm_provider="fallback")  # env default would be fallback
    await set_provider_override(pool, "gemini", settings)
    provider = await resolve_llm_provider(pool, settings)
    assert isinstance(provider, GeminiProvider)


async def test_set_override_to_unconfigured_provider_raises(pool):
    settings = FakeSettings(gemini_api_key=None)  # nothing configured except fallback
    with pytest.raises(UnconfiguredProviderError):
        await set_provider_override(pool, "gemini", settings)


async def test_stale_override_in_db_falls_back_safely_if_now_unconfigured(pool):
    """Defense in depth: if credentials were valid when the override was
    set but have since been removed from the environment (e.g. a key
    rotation), resolution must fall back rather than raise mid-request.
    """
    configured_settings = FakeSettings(gemini_api_key="gm-key")
    await set_provider_override(pool, "gemini", configured_settings)

    now_unconfigured_settings = FakeSettings(llm_provider="fallback", gemini_api_key=None)
    provider = await resolve_llm_provider(pool, now_unconfigured_settings)
    assert isinstance(provider, FallbackTemplateProvider)


async def test_get_llm_provider_settings_reports_configured_and_effective(pool):
    settings = FakeSettings(llm_provider="fallback", gemini_api_key="gm-key")
    await set_provider_override(pool, "gemini", settings)

    info = await get_llm_provider_settings(pool, settings)
    assert "gemini" in info["configured_providers"]
    assert "fallback" in info["configured_providers"]  # always available
    assert info["active_override"] == "gemini"
    assert info["effective_provider"] == "gemini"


async def test_get_llm_provider_settings_with_no_override_reports_env_default(pool):
    settings = FakeSettings(llm_provider="fallback", gemini_api_key=None)
    info = await get_llm_provider_settings(pool, settings)
    assert info["active_override"] is None
    assert info["effective_provider"] == "fallback"


async def test_override_is_cached_across_calls_within_ttl(pool):
    settings = FakeSettings(gemini_api_key="gm-key")
    await set_provider_override(pool, "gemini", settings)

    # Simulate the DB row changing without the in-process cache knowing —
    # the cached value should still win until the TTL expires.
    async with pool.acquire() as conn:
        await conn.execute("UPDATE runtime_settings SET value = 'fallback' WHERE key = 'llm_provider_override'")

    cached = await get_provider_override(pool)
    assert cached == "gemini"
