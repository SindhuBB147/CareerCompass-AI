import pytest

from rag.prompt_template_store import (
    PromptTemplateDeleteError,
    activate_template,
    create_template,
    delete_template,
    get_active_template,
    list_templates,
    update_template,
)


async def test_create_template_starts_inactive(pool):
    row = await create_template(pool, "default", "You are CareerCompass AI.")
    assert row["is_active"] is False
    assert row["version"] == 1
    assert await get_active_template(pool) is None


async def test_activate_template_makes_it_the_active_one(pool):
    row = await create_template(pool, "default", "System prompt text.")
    activated = await activate_template(pool, str(row["id"]))
    assert activated["is_active"] is True

    active = await get_active_template(pool)
    assert active["id"] == row["id"]


async def test_activating_a_new_template_deactivates_the_previous_one(pool):
    first = await create_template(pool, "first", "First prompt.")
    second = await create_template(pool, "second", "Second prompt.")

    await activate_template(pool, str(first["id"]))
    await activate_template(pool, str(second["id"]))

    active = await get_active_template(pool)
    assert active["id"] == second["id"]

    rows = {r["id"]: r for r in await list_templates(pool)}
    assert rows[first["id"]]["is_active"] is False


async def test_activate_missing_template_returns_none(pool):
    result = await activate_template(pool, "00000000-0000-0000-0000-000000000000")
    assert result is None


async def test_update_template_bumps_version(pool):
    row = await create_template(pool, "default", "v1 text")
    updated = await update_template(pool, str(row["id"]), "v2 text")
    assert updated["version"] == 2
    assert updated["system_prompt"] == "v2 text"


async def test_delete_template_rejects_the_active_template(pool):
    row = await create_template(pool, "default", "text")
    await activate_template(pool, str(row["id"]))
    with pytest.raises(PromptTemplateDeleteError):
        await delete_template(pool, str(row["id"]))


async def test_delete_template_rejects_the_last_remaining_template(pool):
    row = await create_template(pool, "only-one", "text")
    with pytest.raises(PromptTemplateDeleteError):
        await delete_template(pool, str(row["id"]))


async def test_delete_template_succeeds_for_inactive_non_last_template(pool):
    first = await create_template(pool, "first", "text")
    second = await create_template(pool, "second", "text")
    await activate_template(pool, str(first["id"]))

    deleted = await delete_template(pool, str(second["id"]))
    assert deleted is True
    assert await list_templates(pool)


async def test_delete_missing_template_returns_false(pool):
    await create_template(pool, "keep-me", "text")  # avoid the last-remaining guard masking this case
    result = await delete_template(pool, "00000000-0000-0000-0000-000000000000")
    assert result is False
