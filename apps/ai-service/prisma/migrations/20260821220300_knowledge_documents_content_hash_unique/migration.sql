-- Hand-authored: Prisma's schema language can't express a partial index
-- (`WHERE` clause on @@unique) — see the comment in schema.prisma.
--
-- Closes a real check-then-insert race: rag/document_processor.py checks
-- get_document_by_hash() then calls upsert_document() as two separate
-- round trips, so two concurrent uploads of identical content could both
-- pass the check and both insert. This constraint makes the DB the actual
-- source of truth for "is this content already ingested", with
-- upsert_document()'s ON CONFLICT (added in the same change) as the
-- application-level backstop.
--
-- Partial (`WHERE deleted_at IS NULL`) so a soft-deleted document's hash
-- can be re-uploaded as a fresh document.
CREATE UNIQUE INDEX "knowledge_documents_content_hash_key"
ON "knowledge_documents" ("content_hash")
WHERE "deleted_at" IS NULL;
