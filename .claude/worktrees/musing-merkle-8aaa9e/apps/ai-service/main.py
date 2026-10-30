import json
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import get_settings
from db.postgres import close_pool, get_pool
from ml.predictor import AdmissionPredictor
from rag.citation_service import build_citations
from rag.document_processor import ingest_document, reindex_all, reindex_document
from rag.embeddings.factory import build_embedding_provider
from rag.intent import classify_intent, expand_query
from rag.llm.base import LlmMessage
from rag.llm.factory import build_llm_provider
from rag.llm.provider_resolver import (
    UnconfiguredProviderError,
    get_llm_provider_settings,
    resolve_llm_provider,
    set_provider_override,
)
from rag.pii import mask_pii
from rag.prompt_builder import build_history, build_system_prompt
from rag.prompt_template_store import (
    PromptTemplateDeleteError,
    activate_template,
    create_template,
    delete_template,
    get_active_template,
    list_templates,
    update_template,
)
from rag.response_validator import validate_response
from rag.retriever import retrieve
from rag.search_entities import extract_entities
from rag.search_intent import classify_search_intent
from rag.suggestion_service import build_suggestions
from rag.vectorstore import delete_document, list_documents, log_retrieval
from schemas import (
    CreatePromptTemplateRequest,
    KnowledgeDocumentStatus,
    KnowledgeStatusResponse,
    KnowledgeUploadResponse,
    LlmProviderSettingsResponse,
    PromptTemplateListResponse,
    PromptTemplateRecord,
    RagQueryRequest,
    RagQueryResponse,
    ReindexRequest,
    ReindexResponse,
    SearchAnalyzeRequest,
    SearchAnalyzeResponse,
    SearchEntities,
    SetLlmProviderRequest,
    UpdatePromptTemplateRequest,
)

settings = get_settings()
embedding_provider = build_embedding_provider(settings)
# Static, env-detected default — used by /health (a liveness probe, not a
# live config display) and as the fallback when no admin override is set.
# The RAG pipeline itself resolves its provider per-request via
# resolve_llm_provider() so an admin's live provider switch (see
# rag/llm/provider_resolver.py) takes effect without a restart.
llm_provider = build_llm_provider(settings)
predictor = AdmissionPredictor()

ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".txt", ".docx"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(title="CareerCompass AI Microservice", version="2.0.0", lifespan=lifespan)


def verify_internal_token(x_internal_token: Optional[str] = Header(default=None)) -> None:
    if settings.internal_token and x_internal_token != settings.internal_token:
        raise HTTPException(status_code=401, detail="Invalid or missing internal service token")


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "ai-service",
        "llm_provider": llm_provider.name,
        "embedding_provider": embedding_provider.name,
    }


# ── RAG query ────────────────────────────────────────────────────────────────

async def _active_prompt_header(pool) -> Optional[str]:
    """Best-effort fetch of the admin-activated prompt template's text. Any
    failure (DB hiccup, no active row) must resolve to None so callers fall
    back to prompt_builder's hardcoded default — this text carries the
    grounding/anti-injection instructions and must never go missing.
    """
    try:
        row = await get_active_template(pool)
        return row["system_prompt"] if row else None
    except Exception:  # noqa: BLE001
        return None


async def _run_rag_pipeline(req: RagQueryRequest):
    pool = await get_pool()
    intent_result = classify_intent(req.query)
    active_llm_provider = await resolve_llm_provider(pool, settings)

    retrieval = await retrieve(
        pool, embedding_provider, settings, req.query, intent_result, req.structured_context
    )

    prompt_header = await _active_prompt_header(pool)
    system_prompt = build_system_prompt(req.student_context, retrieval.items, system_prompt_header=prompt_header)
    history = build_history(
        [t.model_dump() for t in req.conversation_history], max_turns=settings.max_history_turns
    )

    llm_result = await active_llm_provider.generate(system_prompt, history, req.query)

    validation = validate_response(llm_result.text, retrieval.items, llm_result.degraded)
    citations = build_citations(llm_result.text, retrieval.items)
    suggestions = build_suggestions(intent_result.primary, req.structured_context)

    reasoning = (
        f"Classified as a '{intent_result.primary}' question. "
        f"Retrieved {len(retrieval.items)} source(s) "
        f"({len(req.structured_context)} platform record(s), {len(retrieval.items) - len(req.structured_context)} document chunk(s)); "
        f"grounded {validation.grounded_numeric_claims}/{validation.total_numeric_claims} numeric claim(s) in the answer against them."
    )

    try:
        await log_retrieval(
            pool,
            session_id=req.session_id,
            query=mask_pii(req.query),
            intent=intent_result.primary,
            retrieved_chunk_ids=[
                item.source_id for item in retrieval.items if item.source_type == "document"
            ],
            scores={item.tag: item.score for item in retrieval.items},
            confidence_score=validation.confidence_score,
        )
    except Exception:  # noqa: BLE001 — logging must never break the response
        pass

    return RagQueryResponse(
        answer=llm_result.text,
        reasoning=reasoning,
        intent=intent_result.primary,
        confidence_score=validation.confidence_score,
        confidence_level=validation.confidence_level,
        low_confidence=validation.low_confidence,
        sources_cited=citations,
        suggested_questions=suggestions.suggested_questions,
        related_colleges=suggestions.related_colleges,
        action_buttons=suggestions.action_buttons,
        provider=llm_result.provider,
        model=llm_result.model,
        degraded=llm_result.degraded,
        tokens_in=llm_result.tokens_in,
        tokens_out=llm_result.tokens_out,
    )


@app.post("/rag/query", response_model=RagQueryResponse, dependencies=[Depends(verify_internal_token)])
async def rag_query(req: RagQueryRequest):
    return await _run_rag_pipeline(req)


@app.post("/rag/query/stream", dependencies=[Depends(verify_internal_token)])
async def rag_query_stream(req: RagQueryRequest):
    async def event_stream():
        pool = await get_pool()
        intent_result = classify_intent(req.query)
        active_llm_provider = await resolve_llm_provider(pool, settings)
        retrieval = await retrieve(
            pool, embedding_provider, settings, req.query, intent_result, req.structured_context
        )
        prompt_header = await _active_prompt_header(pool)
        system_prompt = build_system_prompt(req.student_context, retrieval.items, system_prompt_header=prompt_header)
        history = build_history(
            [t.model_dump() for t in req.conversation_history], max_turns=settings.max_history_turns
        )

        full_text = ""
        usage_sink: dict = {}
        async for delta in active_llm_provider.generate_stream(system_prompt, history, req.query, usage_sink=usage_sink):
            full_text += delta
            yield f"data: {_sse_json({'delta': delta})}\n\n"

        validation = validate_response(full_text, retrieval.items, provider_degraded=(active_llm_provider.name == "fallback"))
        citations = build_citations(full_text, retrieval.items)
        suggestions = build_suggestions(intent_result.primary, req.structured_context)

        final_payload = {
            "answer": full_text,
            "intent": intent_result.primary,
            "confidence_score": validation.confidence_score,
            "confidence_level": validation.confidence_level,
            "low_confidence": validation.low_confidence,
            "sources_cited": [c.model_dump() for c in citations],
            "suggested_questions": suggestions.suggested_questions,
            "related_colleges": suggestions.related_colleges,
            "action_buttons": [b.model_dump() for b in suggestions.action_buttons],
            "provider": active_llm_provider.name,
            "tokens_in": usage_sink.get("tokens_in", 0),
            "tokens_out": usage_sink.get("tokens_out", 0),
        }
        yield f"event: done\ndata: {_sse_json(final_payload)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _sse_json(payload: dict) -> str:
    return json.dumps(payload)


# ── Smart Search analysis ──────────────────────────────────────────────────────
# Pure regex/keyword logic, no LLM call and no DB access — this sits ahead of
# every structured Mongo query Nest's SearchService issues, so it must stay
# fast and side-effect-free. See rag/search_entities.py and rag/search_intent.py.

@app.post("/search/analyze", response_model=SearchAnalyzeResponse, dependencies=[Depends(verify_internal_token)])
def search_analyze(req: SearchAnalyzeRequest):
    entities = extract_entities(req.query)
    intent_result = classify_search_intent(req.query, entities)
    return SearchAnalyzeResponse(
        intent=intent_result.primary,
        confidence=intent_result.confidence,
        entities=SearchEntities(**entities.__dict__),
        expanded_query=expand_query(req.query),
    )


# ── Knowledge base admin ──────────────────────────────────────────────────────

@app.post("/knowledge/upload", response_model=KnowledgeUploadResponse, dependencies=[Depends(verify_internal_token)])
async def knowledge_upload(
    file: UploadFile = File(...),
    doc_type: str = "brochure",
    title: Optional[str] = None,
    uploaded_by: Optional[str] = None,
):
    ext = _file_extension(file.filename or "")
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_UPLOAD_EXTENSIONS)}")

    raw_bytes = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(raw_bytes) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.max_upload_mb}MB limit")

    pool = await get_pool()
    outcome = await ingest_document(
        pool, embedding_provider, settings,
        title=title or file.filename or "Untitled document",
        doc_type=doc_type, filename=file.filename, raw_bytes=raw_bytes, uploaded_by=uploaded_by,
    )
    return KnowledgeUploadResponse(
        document_id=outcome.document_id, title=outcome.title, status=outcome.status,
        chunk_count=outcome.chunk_count, reused_existing=outcome.reused_existing,
    )


@app.post("/knowledge/reindex", response_model=ReindexResponse, dependencies=[Depends(verify_internal_token)])
async def knowledge_reindex(req: ReindexRequest):
    pool = await get_pool()
    if req.document_id:
        outcome = await reindex_document(pool, embedding_provider, settings, req.document_id)
        if outcome is None:
            raise HTTPException(status_code=404, detail="Document not found")
        return ReindexResponse(reindexed_documents=1, reindexed_chunks=outcome.chunk_count)

    outcome = await reindex_all(pool, embedding_provider, settings)
    docs = await list_documents(pool)
    return ReindexResponse(reindexed_documents=len(docs), reindexed_chunks=outcome.chunk_count)


@app.get("/knowledge/status", response_model=KnowledgeStatusResponse, dependencies=[Depends(verify_internal_token)])
async def knowledge_status():
    pool = await get_pool()
    docs = await list_documents(pool)
    documents = [
        KnowledgeDocumentStatus(
            id=str(d["id"]), title=d["title"], doc_type=d["doc_type"], status=d["status"],
            chunk_count=d["chunk_count"], embedding_model=d["embedding_model"],
            source_filename=d["source_filename"],
            created_at=d["created_at"].isoformat(), updated_at=d["updated_at"].isoformat(),
        )
        for d in docs
    ]
    return KnowledgeStatusResponse(documents=documents, total_chunks=sum(d.chunk_count for d in documents))


@app.delete("/knowledge/{document_id}", dependencies=[Depends(verify_internal_token)])
async def knowledge_delete(document_id: str):
    pool = await get_pool()
    deleted = await delete_document(pool, document_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": True, "document_id": document_id}


def _file_extension(filename: str) -> str:
    idx = filename.rfind(".")
    return filename[idx:].lower() if idx != -1 else ""


# ── Prompt template admin ──────────────────────────────────────────────────────
# Wires the `prompt_templates` table (created by db/postgres.py::init_schema
# but previously unused) to admin CRUD. The active template overrides
# rag/prompt_builder.py's hardcoded SYSTEM_PROMPT_HEADER — see
# _active_prompt_header() above for the fallback safety net.

def _to_prompt_template_record(row) -> PromptTemplateRecord:
    return PromptTemplateRecord(
        id=str(row["id"]), name=row["name"], version=row["version"],
        system_prompt=row["system_prompt"], is_active=row["is_active"],
        created_at=row["created_at"].isoformat(),
    )


@app.get("/prompt-templates", response_model=PromptTemplateListResponse, dependencies=[Depends(verify_internal_token)])
async def prompt_templates_list():
    pool = await get_pool()
    rows = await list_templates(pool)
    return PromptTemplateListResponse(templates=[_to_prompt_template_record(r) for r in rows])


@app.post("/prompt-templates", response_model=PromptTemplateRecord, dependencies=[Depends(verify_internal_token)])
async def prompt_templates_create(req: CreatePromptTemplateRequest):
    pool = await get_pool()
    try:
        row = await create_template(pool, req.name, req.system_prompt)
    except Exception as exc:  # noqa: BLE001 — surface e.g. duplicate-name UNIQUE violation
        raise HTTPException(status_code=400, detail=f"Could not create template: {exc}")
    return _to_prompt_template_record(row)


@app.patch("/prompt-templates/{template_id}", response_model=PromptTemplateRecord, dependencies=[Depends(verify_internal_token)])
async def prompt_templates_update(template_id: str, req: UpdatePromptTemplateRequest):
    pool = await get_pool()
    row = await update_template(pool, template_id, req.system_prompt)
    if row is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return _to_prompt_template_record(row)


@app.post("/prompt-templates/{template_id}/activate", response_model=PromptTemplateRecord, dependencies=[Depends(verify_internal_token)])
async def prompt_templates_activate(template_id: str):
    pool = await get_pool()
    row = await activate_template(pool, template_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return _to_prompt_template_record(row)


@app.delete("/prompt-templates/{template_id}", dependencies=[Depends(verify_internal_token)])
async def prompt_templates_delete(template_id: str):
    pool = await get_pool()
    try:
        deleted = await delete_template(pool, template_id)
    except PromptTemplateDeleteError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"deleted": True, "template_id": template_id}


# ── LLM provider admin (live switch) ────────────────────────────────────────────

@app.get("/settings/llm-provider", response_model=LlmProviderSettingsResponse, dependencies=[Depends(verify_internal_token)])
async def llm_provider_settings():
    pool = await get_pool()
    return LlmProviderSettingsResponse(**await get_llm_provider_settings(pool, settings))


@app.put("/settings/llm-provider", response_model=LlmProviderSettingsResponse, dependencies=[Depends(verify_internal_token)])
async def llm_provider_settings_set(req: SetLlmProviderRequest):
    pool = await get_pool()
    try:
        await set_provider_override(pool, req.provider, settings)
    except UnconfiguredProviderError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return LlmProviderSettingsResponse(**await get_llm_provider_settings(pool, settings))


# ── Admission probability (unchanged) ─────────────────────────────────────────

class PredictRequest(BaseModel):
    student_rank: int
    closing_rank: int


class PredictResponse(BaseModel):
    probability_percent: float
    band: str
    confidence: str


@app.post("/predict-probability", response_model=PredictResponse)
def predict_probability(req: PredictRequest):
    return predictor.predict(req.student_rank, req.closing_rank)
