-- Hand-authored: Prisma's schema language has no CHECK constraint syntax
-- (see prisma/prisma#3388, still open as of this writing).
--
-- The "Upload History" / processing-status audit trail — one row per real
-- transition rag/document_processor.py and rag/vectorstore.py already
-- detect (upload, dedup-reuse, reindex, failure, soft delete, restore).
CREATE TABLE "knowledge_document_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
    "event_type" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "actor" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "knowledge_document_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "knowledge_document_events_event_type_check" CHECK (
        "event_type" IN ('uploaded', 'reused_duplicate', 'reindexed', 'failed', 'deleted', 'restored')
    )
);

CREATE INDEX "knowledge_document_events_document_id_created_at_idx"
ON "knowledge_document_events" ("document_id", "created_at");
