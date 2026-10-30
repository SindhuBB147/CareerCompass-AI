-- Hand-authored: Prisma can't express `USING hnsw` (or `USING ivfflat`) —
-- see the comment on the `chunks` model in schema.prisma.
--
-- ivfflat needed a `lists` parameter tuned to row count and behaved poorly
-- on a cold/near-empty table (see the old comment this replaces in
-- db/postgres.py's former ad hoc DDL). HNSW needs no such tuning and is
-- pgvector's recommended default from 0.5.0 onward — bundled version here
-- is 0.8.6 (pgvector/pgvector:pg17 image), confirmed HNSW-capable.
DROP INDEX "chunks_embedding_idx";

CREATE INDEX "chunks_embedding_idx"
ON "chunks" USING hnsw ("embedding" vector_cosine_ops);
