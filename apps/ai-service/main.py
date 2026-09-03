import json
import os
from contextlib import asynccontextmanager
from typing import Optional, Any
import joblib
import pandas as pd

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
from rag.pii import mask_pii
from rag.prompt_builder import build_history, build_system_prompt
from rag.response_validator import validate_response
from rag.retriever import retrieve
from rag.search_entities import extract_entities
from rag.search_intent import classify_search_intent
from rag.suggestion_service import build_suggestions
from rag.vectorstore import delete_document, list_documents, log_retrieval
from schemas import (
    KnowledgeDocumentStatus,
    KnowledgeStatusResponse,
    KnowledgeUploadResponse,
    RagQueryRequest,
    RagQueryResponse,
    ReindexRequest,
    ReindexResponse,
    SearchAnalyzeRequest,
    SearchAnalyzeResponse,
    SearchEntities,
    PredictMLRequest,
    PredictMLResponse,
)

settings = get_settings()
embedding_provider = build_embedding_provider(settings)
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

async def _run_rag_pipeline(req: RagQueryRequest):
    pool = await get_pool()
    intent_result = classify_intent(req.query)

    retrieval = await retrieve(
        pool, embedding_provider, settings, req.query, intent_result, req.structured_context
    )

    system_prompt = build_system_prompt(req.student_context, retrieval.items)
    history = build_history(
        [t.model_dump() for t in req.conversation_history], max_turns=settings.max_history_turns
    )

    llm_result = await llm_provider.generate(system_prompt, history, req.query)

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
    )


@app.post("/rag/query", response_model=RagQueryResponse, dependencies=[Depends(verify_internal_token)])
async def rag_query(req: RagQueryRequest):
    return await _run_rag_pipeline(req)


@app.post("/rag/query/stream", dependencies=[Depends(verify_internal_token)])
async def rag_query_stream(req: RagQueryRequest):
    async def event_stream():
        pool = await get_pool()
        intent_result = classify_intent(req.query)
        retrieval = await retrieve(
            pool, embedding_provider, settings, req.query, intent_result, req.structured_context
        )
        system_prompt = build_system_prompt(req.student_context, retrieval.items)
        history = build_history(
            [t.model_dump() for t in req.conversation_history], max_turns=settings.max_history_turns
        )

        full_text = ""
        async for delta in llm_provider.generate_stream(system_prompt, history, req.query):
            full_text += delta
            yield f"data: {_sse_json({'delta': delta})}\n\n"

        validation = validate_response(full_text, retrieval.items, provider_degraded=(llm_provider.name == "fallback"))
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
            "provider": llm_provider.name,
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


# ── ML Model Prediction Endpoint ──────────────────────────────────────────────

ml_models = {}

def get_ml_model(exam: str):
    exam = exam.upper()
    if exam not in ml_models:
        model_filename = f"{exam.lower()}_best_model.joblib"
        model_path = os.path.join(os.path.dirname(__file__), "ml", "models", model_filename)
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file for exam {exam} not found at {model_path}")
        ml_models[exam] = joblib.load(model_path)
    return ml_models[exam]


@app.post("/predict", response_model=PredictMLResponse)
def predict_ml(req: PredictMLRequest):
    exam = req.exam.upper()
    if exam not in ["KCET", "COMEDK"]:
        raise HTTPException(status_code=400, detail=f"Unsupported exam: {req.exam}")
    
    try:
        model = get_ml_model(exam)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading model: {str(e)}")

    try:
        if exam == "KCET":
            data = {
                'year': [int(req.year)],
                'round': [int(req.round) if str(req.round).isdigit() else 1],
                'collegeCode': [req.college_code],
                'courseCode': [req.course_code],
                'category': [req.category],
                'quota': [req.quota if req.quota is not None else 'missing'],
                'collegeType': [req.college_type if req.college_type is not None else 'missing']
            }
            cols = ['year', 'round', 'collegeCode', 'courseCode', 'category', 'quota', 'collegeType']
        else: # COMEDK
            data = {
                'year': [int(req.year)],
                'round': [str(req.round)],
                'college_code': [req.college_code],
                'course_normalized': [req.course_code],
                'seat_category': [req.category]
            }
            cols = ['year', 'round', 'college_code', 'course_normalized', 'seat_category']
            
        df = pd.DataFrame(data, columns=cols)
        prediction = model.predict(df)[0]
        
        predicted_rank = int(round(prediction))
        if predicted_rank <= 0:
            predicted_rank = 1
            
        return PredictMLResponse(
            success=True,
            exam=exam,
            predictedClosingRank=predicted_rank,
            model="random_forest",
            modelVersion="v2.0-p1-recommendation",
            confidence=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")

