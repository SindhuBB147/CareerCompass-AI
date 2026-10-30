import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Point at a dedicated test database *before* config.py's settings are
# cached, so vectorstore/db tests never touch the dev database.
os.environ.setdefault(
    "DATABASE_URL", "postgresql://localhost:5433/career_compass_rag_test"
)

import asyncpg  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402

from config import get_settings  # noqa: E402
from db.postgres import _init_connection, init_schema  # noqa: E402


@pytest_asyncio.fixture
async def pool():
    """Function-scoped pool, independent of the app's cached global pool
    (db.postgres.get_pool()) — that singleton is bound to whichever event
    loop first created it, which breaks under pytest-asyncio's per-test
    event loops. Tests get their own short-lived pool instead.
    """
    settings = get_settings()
    p = await asyncpg.create_pool(settings.database_url, init=_init_connection, min_size=1, max_size=5)
    await init_schema(p)
    async with p.acquire() as conn:
        await conn.execute(
            "TRUNCATE knowledge_documents, chunks, retrieval_logs, prompt_templates, runtime_settings CASCADE"
        )
    yield p
    await p.close()


@pytest.fixture
def settings():
    return get_settings()
