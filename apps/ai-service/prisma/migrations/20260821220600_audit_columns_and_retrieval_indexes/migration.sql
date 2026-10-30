-- AlterTable
ALTER TABLE "prompt_templates" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "updated_by" TEXT;

-- AlterTable
ALTER TABLE "runtime_settings" ADD COLUMN     "updated_by" TEXT;

-- CreateIndex
CREATE INDEX "retrieval_logs_session_id_created_at_idx" ON "retrieval_logs"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "retrieval_logs_intent_idx" ON "retrieval_logs"("intent");
