from fastapi.testclient import TestClient

import main
from conftest import make_pdf_bytes


def _upload(client, doc_type: str, text: bytes, filename: str = "t.txt"):
    return client.post(
        "/knowledge/upload",
        params={"doc_type": doc_type},
        files={"file": (filename, text, "text/plain")},
    )


def test_upload_rejects_unknown_doc_type_with_400_not_500(monkeypatch, pool):
    """The doc_type -> knowledge_categories FK makes an invalid category a
    DB constraint violation — this must surface as a clean 400 (matching
    the existing prompt_templates_create error-handling pattern), not an
    unhandled 500.
    """
    monkeypatch.setattr(main.settings, "internal_token", None)
    with TestClient(main.app) as client:
        resp = _upload(client, "not_a_real_category", b"hello world")
    assert resp.status_code == 400
    assert "not_a_real_category" in resp.json()["detail"]


def test_upload_accepts_a_real_category(monkeypatch, pool):
    monkeypatch.setattr(main.settings, "internal_token", None)
    with TestClient(main.app) as client:
        resp = _upload(client, "faq", b"RVCE placements and hostel fees information")
    assert resp.status_code == 200
    assert resp.json()["status"] == "indexed"


def test_knowledge_status_q_param_finds_uploaded_document(monkeypatch, pool):
    monkeypatch.setattr(main.settings, "internal_token", None)
    with TestClient(main.app) as client:
        upload = _upload(client, "faq", b"unique-marker-token about hostel fees", filename="hostel.txt")
        doc_id = upload.json()["document_id"]

        found = client.get("/knowledge/status", params={"q": "unique-marker-token"})
        assert found.status_code == 200
        assert any(d["id"] == doc_id for d in found.json()["documents"])

        not_found = client.get("/knowledge/status", params={"q": "nothing-matches-this-xyz"})
        assert not_found.status_code == 200
        assert not any(d["id"] == doc_id for d in not_found.json()["documents"])


def test_delete_then_restore_round_trip(monkeypatch, pool):
    monkeypatch.setattr(main.settings, "internal_token", None)
    with TestClient(main.app) as client:
        upload = _upload(client, "faq", b"content to delete and restore")
        doc_id = upload.json()["document_id"]

        deleted = client.delete(f"/knowledge/{doc_id}")
        assert deleted.status_code == 200

        after_delete = client.get("/knowledge/status")
        assert all(d["id"] != doc_id for d in after_delete.json()["documents"])

        restored = client.post(f"/knowledge/{doc_id}/restore")
        assert restored.status_code == 200

        after_restore = client.get("/knowledge/status")
        assert any(d["id"] == doc_id for d in after_restore.json()["documents"])


def test_restore_a_document_that_is_not_deleted_returns_404(monkeypatch, pool):
    monkeypatch.setattr(main.settings, "internal_token", None)
    with TestClient(main.app) as client:
        upload = _upload(client, "faq", b"never deleted")
        doc_id = upload.json()["document_id"]

        resp = client.post(f"/knowledge/{doc_id}/restore")
        assert resp.status_code == 404


async def test_delete_and_restore_are_recorded_in_the_document_event_log(monkeypatch, pool):
    monkeypatch.setattr(main.settings, "internal_token", None)
    with TestClient(main.app) as client:
        upload = _upload(client, "faq", b"event log coverage")
        doc_id = upload.json()["document_id"]
        client.delete(f"/knowledge/{doc_id}")
        client.post(f"/knowledge/{doc_id}/restore")

    # TestClient's lifespan uses its own pool (same DATABASE_URL, separate
    # connection) — query the shared `pool` fixture to see the committed
    # rows, same pattern as every other DB-asserting test in this suite.
    rows = await pool.fetch(
        "SELECT event_type FROM knowledge_document_events WHERE document_id = $1 ORDER BY created_at",
        doc_id,
    )
    assert [r["event_type"] for r in rows] == ["uploaded", "deleted", "restored"]


def test_upload_rejects_unsupported_extension(monkeypatch, pool):
    monkeypatch.setattr(main.settings, "internal_token", None)
    with TestClient(main.app) as client:
        resp = client.post(
            "/knowledge/upload",
            params={"doc_type": "faq"},
            files={"file": ("data.xlsx", b"whatever", "application/octet-stream")},
        )
    assert resp.status_code == 400


def test_upload_accepts_csv_and_indexes_rows(monkeypatch, pool):
    monkeypatch.setattr(main.settings, "internal_token", None)
    csv_bytes = b"college,course,seats\nRVCE,CSE,120\nBMSCE,ISE,90\n"
    with TestClient(main.app) as client:
        resp = client.post(
            "/knowledge/upload",
            params={"doc_type": "brochure"},
            files={"file": ("seats.csv", csv_bytes, "text/csv")},
        )
    assert resp.status_code == 200
    assert resp.json()["status"] == "indexed"


def test_upload_accepts_json_and_indexes_records(monkeypatch, pool):
    monkeypatch.setattr(main.settings, "internal_token", None)
    json_bytes = b'[{"college": "RVCE", "seats": 120}, {"college": "BMSCE", "seats": 90}]'
    with TestClient(main.app) as client:
        resp = client.post(
            "/knowledge/upload",
            params={"doc_type": "brochure"},
            files={"file": ("seats.json", json_bytes, "application/json")},
        )
    assert resp.status_code == 200
    assert resp.json()["status"] == "indexed"


def test_upload_scanned_pdf_returns_needs_ocr_status(monkeypatch, pool):
    monkeypatch.setattr(main.settings, "internal_token", None)
    with TestClient(main.app) as client:
        resp = client.post(
            "/knowledge/upload",
            params={"doc_type": "faq"},
            files={"file": ("scanned.pdf", make_pdf_bytes(["", ""]), "application/pdf")},
        )
    assert resp.status_code == 200
    assert resp.json()["status"] == "needs_ocr"


def test_knowledge_categories_returns_seeded_categories(monkeypatch, pool):
    monkeypatch.setattr(main.settings, "internal_token", None)
    with TestClient(main.app) as client:
        resp = client.get("/knowledge/categories")
    assert resp.status_code == 200
    codes = {c["code"] for c in resp.json()["categories"]}
    assert "faq" in codes and "brochure" in codes


def test_knowledge_chunks_returns_page_numbers_for_pdf_upload(monkeypatch, pool):
    monkeypatch.setattr(main.settings, "internal_token", None)
    page_text = "Admissions information for the CSE branch at RVCE college. " * 20
    with TestClient(main.app) as client:
        upload = client.post(
            "/knowledge/upload",
            params={"doc_type": "faq"},
            files={"file": ("brochure.pdf", make_pdf_bytes([page_text]), "application/pdf")},
        )
        doc_id = upload.json()["document_id"]

        resp = client.get(f"/knowledge/{doc_id}/chunks")
    assert resp.status_code == 200
    body = resp.json()
    assert body["document_id"] == doc_id
    assert len(body["chunks"]) > 0
    assert all(c["page_number"] == 1 for c in body["chunks"])


def test_knowledge_chunks_404s_for_unknown_document(monkeypatch, pool):
    monkeypatch.setattr(main.settings, "internal_token", None)
    with TestClient(main.app) as client:
        resp = client.get("/knowledge/00000000-0000-0000-0000-000000000000/chunks")
    assert resp.status_code == 404
