-- Soft delete + audit columns on knowledge_documents, plus indexes on the
-- two columns admin listing/filtering already queries by.

-- AlterTable
ALTER TABLE "knowledge_documents" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "deleted_by" TEXT,
ADD COLUMN     "updated_by" TEXT;

-- CreateIndex
CREATE INDEX "knowledge_documents_status_idx" ON "knowledge_documents"("status");

-- CreateIndex
CREATE INDEX "knowledge_documents_doc_type_idx" ON "knowledge_documents"("doc_type");
