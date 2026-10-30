from typing import List, Optional

import asyncpg


class PromptTemplateDeleteError(Exception):
    """Raised when a delete would remove the active or last-remaining template."""


async def list_templates(pool: asyncpg.Pool) -> List[asyncpg.Record]:
    async with pool.acquire() as conn:
        return await conn.fetch("SELECT * FROM prompt_templates ORDER BY created_at DESC")


async def get_template(pool: asyncpg.Pool, template_id: str) -> Optional[asyncpg.Record]:
    async with pool.acquire() as conn:
        return await conn.fetchrow("SELECT * FROM prompt_templates WHERE id = $1", template_id)


async def get_active_template(pool: asyncpg.Pool) -> Optional[asyncpg.Record]:
    """Returns the single active template, if any. Callers (main.py) must
    treat a `None` result — including any DB error — as "use the hardcoded
    default", never as an error to surface to the user; see
    rag/prompt_builder.py's own blank-check for the second safety net.
    """
    async with pool.acquire() as conn:
        return await conn.fetchrow("SELECT * FROM prompt_templates WHERE is_active = true LIMIT 1")


async def create_template(pool: asyncpg.Pool, name: str, system_prompt: str) -> asyncpg.Record:
    """New templates start inactive — an admin must explicitly activate one
    via `activate_template`, which is the only path that flips `is_active`.
    This keeps "at most one active template" an invariant maintained in one
    place instead of scattered across every write path.
    """
    async with pool.acquire() as conn:
        return await conn.fetchrow(
            """
            INSERT INTO prompt_templates (name, version, system_prompt, is_active)
            VALUES ($1, 1, $2, false)
            RETURNING *
            """,
            name, system_prompt,
        )


async def update_template(pool: asyncpg.Pool, template_id: str, system_prompt: str) -> Optional[asyncpg.Record]:
    async with pool.acquire() as conn:
        return await conn.fetchrow(
            """
            UPDATE prompt_templates
            SET system_prompt = $2, version = version + 1
            WHERE id = $1
            RETURNING *
            """,
            template_id, system_prompt,
        )


async def activate_template(pool: asyncpg.Pool, template_id: str) -> Optional[asyncpg.Record]:
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("UPDATE prompt_templates SET is_active = false WHERE is_active = true")
            return await conn.fetchrow(
                "UPDATE prompt_templates SET is_active = true WHERE id = $1 RETURNING *",
                template_id,
            )


async def delete_template(pool: asyncpg.Pool, template_id: str) -> bool:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT is_active FROM prompt_templates WHERE id = $1", template_id)
        if row is None:
            return False
        if row["is_active"]:
            raise PromptTemplateDeleteError("Cannot delete the active template — activate another one first.")

        total = await conn.fetchval("SELECT count(*) FROM prompt_templates")
        if total <= 1:
            raise PromptTemplateDeleteError("Cannot delete the last remaining template.")

        result = await conn.execute("DELETE FROM prompt_templates WHERE id = $1", template_id)
    return result.endswith("1")
