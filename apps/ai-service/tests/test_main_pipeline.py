import json

from fastapi.testclient import TestClient

import main
from rag.llm.fallback_provider import FallbackTemplateProvider

REQUEST_BODY = {
    "query": "Which college can I get?",
    "student_context": {"rank": 5000, "category": "General"},
    "structured_context": [
        {"type": "college", "id": "c1", "title": "RVCE", "content": "RVCE CSE closing rank around 5200."},
    ],
    "conversation_history": [],
}


async def _fake_resolve_llm_provider(pool, settings):
    return FallbackTemplateProvider()


def test_rag_query_end_to_end_with_stubbed_provider(monkeypatch):
    """First API-level test for main.py: exercises the whole pipeline —
    intent classification, retrieval (merging the caller-supplied
    structured_context), prompt building, the LLM call, response
    validation, citations, and suggestions — through the real HTTP layer.
    The LLM provider is stubbed to avoid a real network call; retrieval
    still runs for real against the test database.
    """
    monkeypatch.setattr(main, "resolve_llm_provider", _fake_resolve_llm_provider)
    monkeypatch.setattr(main.settings, "internal_token", None)

    with TestClient(main.app) as client:
        resp = client.post("/rag/query", json=REQUEST_BODY)

    assert resp.status_code == 200
    data = resp.json()
    assert "RVCE" in data["answer"]
    assert data["provider"] == "fallback"
    assert data["degraded"] is True
    assert data["tokens_in"] == 0
    assert data["tokens_out"] == 0
    assert 0.0 <= data["confidence_score"] <= 1.0
    assert data["sources_cited"]


def test_health_endpoint_reports_providers():
    with TestClient(main.app) as client:
        resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "llm_provider" in body and "embedding_provider" in body


def test_rag_query_stream_final_frame_includes_token_usage(monkeypatch):
    monkeypatch.setattr(main, "resolve_llm_provider", _fake_resolve_llm_provider)
    monkeypatch.setattr(main.settings, "internal_token", None)

    with TestClient(main.app) as client:
        with client.stream("POST", "/rag/query/stream", json=REQUEST_BODY) as resp:
            assert resp.status_code == 200
            body = "".join(resp.iter_text())

    assert "event: done" in body
    done_data_line = next(
        line for line in body.splitlines() if line.startswith("data:") and "tokens_in" in line
    )
    payload = json.loads(done_data_line[len("data:"):].strip())
    assert payload["tokens_in"] == 0
    assert payload["tokens_out"] == 0
    assert payload["provider"] == "fallback"


def test_rag_query_rejects_missing_internal_token_when_configured(monkeypatch):
    monkeypatch.setattr(main.settings, "internal_token", "a-real-secret")
    with TestClient(main.app) as client:
        resp = client.post("/rag/query", json=REQUEST_BODY)
    assert resp.status_code == 401
