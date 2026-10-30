import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Point at a dedicated test database *before* config.py's settings are
# cached, so vectorstore/db tests never touch the dev database.
os.environ.setdefault(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5434/career_compass_rag_test"
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
    await init_schema(settings.database_url)
    p = await asyncpg.create_pool(settings.database_url, init=_init_connection, min_size=1, max_size=5)
    async with p.acquire() as conn:
        await conn.execute(
            "TRUNCATE knowledge_documents, chunks, retrieval_logs, prompt_templates, runtime_settings CASCADE"
        )
    yield p
    await p.close()


@pytest.fixture
def settings():
    return get_settings()


def make_pdf_bytes(pages_text: list[str]) -> bytes:
    """Hand-rolled minimal multi-page PDF (no reportlab dependency) with
    real, pypdf-extractable text per page — used to test page-aware PDF
    extraction against an actual PDF rather than mocking pypdf internals.
    An empty string produces a page with no text-drawing content stream at
    all, i.e. a page pypdf will genuinely extract "" from (simulating a
    scanned/image-only page).
    """
    import io as _io

    n_pages = len(pages_text)
    page_objs = []
    content_objs = []
    for i, text in enumerate(pages_text):
        content = (
            f"BT /F1 12 Tf 10 100 Td ({text}) Tj ET".encode() if text else b""
        )
        content_obj_num = 3 + n_pages + i
        page_objs.append(
            f"<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 {3 + n_pages * 2} 0 R>>>>"
            f"/MediaBox[0 0 200 200]/Contents {content_obj_num} 0 R>>".encode()
        )
        content_objs.append(f"<</Length {len(content)}>>\nstream\n".encode() + content + b"\nendstream")

    kids = " ".join(f"{3 + i} 0 R" for i in range(n_pages))
    all_objs = [
        b"<</Type/Catalog/Pages 2 0 R>>",
        f"<</Type/Pages/Kids[{kids}]/Count {n_pages}>>".encode(),
        *page_objs,
        *content_objs,
        b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    ]

    buf = _io.BytesIO()
    buf.write(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(all_objs, start=1):
        offsets.append(buf.tell())
        buf.write(f"{i} 0 obj".encode() + obj + b"endobj\n")
    xref_offset = buf.tell()
    buf.write(f"xref\n0 {len(all_objs) + 1}\n".encode())
    buf.write(b"0000000000 65535 f \n")
    for off in offsets:
        buf.write(f"{off:010d} 00000 n \n".encode())
    buf.write(f"trailer\n<</Size {len(all_objs) + 1}/Root 1 0 R>>\nstartxref\n{xref_offset}\n%%EOF".encode())
    return buf.getvalue()
