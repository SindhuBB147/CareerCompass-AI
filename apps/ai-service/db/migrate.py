"""Applies the versioned SQL migrations under prisma/migrations/.

Those files are authored via the Prisma CLI (schema/migration authoring
only — see prisma/README.md) but applied here by a small, dependency-light
runner instead of the `prisma` CLI itself: the production image is pure
Python (no Node), and there's no existing Helm Job/initContainer convention
in infra/k8s to hang a `prisma migrate deploy` step off of. This keeps the
service's existing "just boot it" zero-ops shape while making the schema
actually versioned.
"""

import logging
from pathlib import Path

import asyncpg

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "prisma" / "migrations"

# Fixed, never-changing key so every replica/test run contends for the same
# advisory lock. Arbitrary value — just needs to never change once chosen,
# and to not collide with a lock key used elsewhere in this DB (nothing
# else takes one today).
_ADVISORY_LOCK_KEY = 987_654_321_123

_BOOTSTRAP_SQL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
"""


def _discover_migrations() -> list[tuple[str, Path]]:
    """(version, sql_file) pairs sorted lexicographically — the
    `<timestamp>_<name>` directory naming convention makes lexical order
    match chronological order.
    """
    if not MIGRATIONS_DIR.is_dir():
        return []
    migrations = []
    for entry in sorted(MIGRATIONS_DIR.iterdir()):
        sql_file = entry / "migration.sql"
        if entry.is_dir() and sql_file.is_file():
            migrations.append((entry.name, sql_file))
    return migrations


async def run_migrations(database_url: str) -> int:
    """Applies any not-yet-applied migrations, each in its own transaction,
    in order. Safe to call concurrently from multiple replicas booting at
    once (infra/k8s/ai-service runs replicas: 2, scaling to 10 via HPA) —
    a session-level pg_advisory_lock on a dedicated connection, held for
    the whole run, serializes it; whichever replica doesn't win the lock
    simply finds nothing left to apply once its turn comes.

    Returns the number of migrations newly applied (0 on a clean re-run).
    """
    conn = await asyncpg.connect(database_url)
    try:
        await conn.execute(f"SELECT pg_advisory_lock({_ADVISORY_LOCK_KEY})")
        try:
            # Postgres's own `IF NOT EXISTS` DDL isn't safe under true
            # concurrent execution (a well-known race on the catalog's
            # unique index — confirmed empirically here, two concurrent
            # `CREATE EXTENSION IF NOT EXISTS` calls can both pass the
            # existence check and then collide on insert). Everything
            # that touches shared schema state, extension included, must
            # happen after the advisory lock is held, not before.
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            await conn.execute(_BOOTSTRAP_SQL)
            applied = {
                r["version"]
                for r in await conn.fetch("SELECT version FROM schema_migrations")
            }

            newly_applied = 0
            for version, sql_file in _discover_migrations():
                if version in applied:
                    continue
                sql = sql_file.read_text()
                async with conn.transaction():
                    await conn.execute(sql)
                    await conn.execute(
                        "INSERT INTO schema_migrations (version) VALUES ($1)",
                        version,
                    )
                logger.info("Applied migration %s", version)
                newly_applied += 1
            return newly_applied
        finally:
            await conn.execute(f"SELECT pg_advisory_unlock({_ADVISORY_LOCK_KEY})")
    finally:
        await conn.close()
