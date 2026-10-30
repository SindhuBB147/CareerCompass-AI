from typing import Optional

import asyncpg


async def get_setting(pool: asyncpg.Pool, key: str) -> Optional[str]:
    async with pool.acquire() as conn:
        return await conn.fetchval("SELECT value FROM runtime_settings WHERE key = $1", key)


async def set_setting(pool: asyncpg.Pool, key: str, value: str) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO runtime_settings (key, value, updated_at)
            VALUES ($1, $2, now())
            ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()
            """,
            key, value,
        )
