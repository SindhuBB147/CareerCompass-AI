import time
from typing import Optional

import asyncpg

from config import Settings

from .base import LLMProvider
from .factory import build_llm_provider, configured_providers, instantiate_llm_provider, is_provider_configured

RUNTIME_SETTING_KEY = "llm_provider_override"
_CACHE_TTL_SECONDS = 30.0

# In-process cache of the resolved override so a lightly-loaded chat
# endpoint isn't hitting Postgres on every single request just to read one
# row that almost never changes. Safe across multiple ai-service instances
# sharing one Postgres — each just has up to _CACHE_TTL_SECONDS of staleness
# after an admin flips the setting, not a correctness issue for an admin
# convenience feature like this.
_cache: dict = {"value": None, "fetched_at": 0.0}


class UnconfiguredProviderError(Exception):
    pass


async def get_provider_override(pool: asyncpg.Pool) -> Optional[str]:
    now = time.monotonic()
    if now - _cache["fetched_at"] < _CACHE_TTL_SECONDS:
        return _cache["value"]

    from rag.runtime_settings import get_setting  # local import avoids a cycle at module load

    value = await get_setting(pool, RUNTIME_SETTING_KEY)
    _cache["value"] = value
    _cache["fetched_at"] = now
    return value


async def set_provider_override(pool: asyncpg.Pool, provider: str, settings: Settings) -> None:
    if not is_provider_configured(provider, settings):
        raise UnconfiguredProviderError(
            f"Provider '{provider}' has no credentials configured on this ai-service instance."
        )
    from rag.runtime_settings import set_setting

    await set_setting(pool, RUNTIME_SETTING_KEY, provider)
    _cache["value"] = provider
    _cache["fetched_at"] = time.monotonic()


async def resolve_llm_provider(pool: asyncpg.Pool, settings: Settings) -> LLMProvider:
    """Per-request provider resolution honoring the admin override when
    present and still configured, falling back to the env-detected default
    (`build_llm_provider`) otherwise. Embedding provider is intentionally
    not part of this — see the AI Counsellor completion plan for why
    switching it live is unsafe without a full reindex.
    """
    override = await get_provider_override(pool)
    if override and is_provider_configured(override, settings):
        return instantiate_llm_provider(override, settings)
    return build_llm_provider(settings)


async def get_llm_provider_settings(pool: asyncpg.Pool, settings: Settings) -> dict:
    override = await get_provider_override(pool)
    effective = override if override and is_provider_configured(override, settings) else settings.llm_provider
    return {
        "configured_providers": configured_providers(settings),
        "active_override": override,
        "effective_provider": effective,
    }
