-- Knowledge categories lookup table, replacing free-text `doc_type` with a
-- DB-validated FK. Seeded with the 7 real values already hardcoded in
-- apps/web/src/app/admin/knowledge/page.tsx's DOC_TYPES constant — that's
-- the single source of truth this migration mirrors, not invented data.

-- CreateTable
CREATE TABLE "knowledge_categories" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "knowledge_categories_pkey" PRIMARY KEY ("code")
);

-- Seed: required reference data an FK below depends on, not optional demo
-- data — must exist everywhere this migration runs (dev/CI/prod alike).
INSERT INTO "knowledge_categories" ("code", "label", "sort_order") VALUES
    ('brochure', 'College Brochure', 0),
    ('admission_rules', 'Admission Rules', 1),
    ('scholarship_pdf', 'Scholarship PDF', 2),
    ('circular', 'Government Circular', 3),
    ('placement_report', 'Placement Report', 4),
    ('faq', 'FAQ', 5),
    ('general', 'General', 6)
ON CONFLICT ("code") DO NOTHING;

-- A direct API caller (not the admin web UI, which only ever sends one of
-- the 7 values above) could have stored an arbitrary doc_type string before
-- this constraint existed. Coerce any such orphan to 'general' so the FK
-- below is guaranteed to succeed instead of failing a real upgrade.
UPDATE "knowledge_documents"
SET "doc_type" = 'general'
WHERE "doc_type" NOT IN (SELECT "code" FROM "knowledge_categories");

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_doc_type_fkey" FOREIGN KEY ("doc_type") REFERENCES "knowledge_categories"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
