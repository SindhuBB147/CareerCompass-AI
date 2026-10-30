-- A PDF with no extractable text layer (a scanned/image-only PDF) is a
-- distinct, expected outcome, not a processing failure — widen the event
-- log's allowed event_type values so it can be recorded as its own thing
-- instead of being force-fit into 'failed'.

ALTER TABLE "knowledge_document_events" DROP CONSTRAINT "knowledge_document_events_event_type_check";
ALTER TABLE "knowledge_document_events" ADD CONSTRAINT "knowledge_document_events_event_type_check"
    CHECK ("event_type" IN ('uploaded', 'reused_duplicate', 'reindexed', 'failed', 'deleted', 'restored', 'needs_ocr'));
