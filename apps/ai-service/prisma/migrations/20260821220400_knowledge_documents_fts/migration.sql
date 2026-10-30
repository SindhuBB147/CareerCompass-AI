-- Hand-authored: Prisma has no concept of a GENERATED ALWAYS AS STORED
-- column, so this can't be modeled in schema.prisma at all.
--
-- Backs rag/vectorstore.py's keyword_search(), wired into
-- GET /knowledge/status?q=... as an admin search box over ingested
-- documents (title + content), independent of pgvector similarity search.
ALTER TABLE "knowledge_documents"
ADD COLUMN "search_vector" tsvector
GENERATED ALWAYS AS (to_tsvector('english', "title" || ' ' || "content")) STORED;

CREATE INDEX "knowledge_documents_search_vector_idx"
ON "knowledge_documents" USING GIN ("search_vector");
