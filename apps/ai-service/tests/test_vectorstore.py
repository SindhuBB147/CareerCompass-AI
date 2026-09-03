from rag.embeddings.local_hash_embeddings import LocalHashEmbeddingProvider
from rag.vectorstore import (
    delete_document,
    get_document_by_hash,
    list_documents,
    replace_chunks,
    similarity_search,
    upsert_document,
)

# Must match the pgvector column's fixed dimension (EMBEDDING_DIM, default
# 1536) — asyncpg rejects vectors of any other length at insert time.
EMB = LocalHashEmbeddingProvider(dimension=1536)


async def _seed_document(pool, title: str, text: str, doc_type: str = "faq"):
    doc = await upsert_document(
        pool, title=title, doc_type=doc_type, source_filename=f"{title}.txt",
        content_hash=f"hash-{title}", content=text, metadata={}, uploaded_by="test",
    )
    embedding = await EMB.embed_one(text)
    await replace_chunks(
        pool, str(doc["id"]),
        [{"text": text, "metadata": {"document_id": str(doc["id"])}, "embedding": embedding}],
        embedding_model="local_hash",
    )
    return doc


async def test_upsert_and_similarity_search_roundtrip(pool):
    await _seed_document(pool, "RVCE FAQ", "RVCE CSE closing rank KCET placements")
    await _seed_document(pool, "BMSCE FAQ", "BMSCE ISE fees hostel information")

    query_embedding = await EMB.embed_one("What is the KCET closing rank at RVCE?")
    results = await similarity_search(pool, query_embedding, top_k=5)

    assert len(results) == 2
    # The RVCE document shares more tokens with the query, so it should rank first.
    assert results[0].document_title == "RVCE FAQ"
    assert 0.0 <= results[0].score <= 1.0 or results[0].score <= 1.0001


async def test_doc_type_filter_excludes_other_types(pool):
    await _seed_document(pool, "Scholarship Circular", "SC ST scholarship deadline documents", doc_type="scholarship_pdf")
    await _seed_document(pool, "Admission Rules", "KCET counselling rounds choice filling rules", doc_type="admission_rules")

    query_embedding = await EMB.embed_one("scholarship deadline documents")
    results = await similarity_search(pool, query_embedding, top_k=5, doc_types=["scholarship_pdf"])

    assert len(results) == 1
    assert results[0].document_title == "Scholarship Circular"


async def test_content_hash_dedup_returns_existing_document(pool):
    doc = await upsert_document(
        pool, title="Dup Test", doc_type="faq", source_filename="dup.txt",
        content_hash="same-hash-123", content="some content", metadata={}, uploaded_by="test",
    )
    fetched = await get_document_by_hash(pool, "same-hash-123")
    assert fetched is not None
    assert str(fetched["id"]) == str(doc["id"])

    missing = await get_document_by_hash(pool, "does-not-exist")
    assert missing is None


async def test_delete_document_cascades_chunks(pool):
    doc = await _seed_document(pool, "To Delete", "temporary content for deletion test")
    deleted = await delete_document(pool, str(doc["id"]))
    assert deleted is True

    docs = await list_documents(pool)
    assert all(str(d["id"]) != str(doc["id"]) for d in docs)

    query_embedding = await EMB.embed_one("temporary content")
    results = await similarity_search(pool, query_embedding, top_k=10)
    assert all(r.document_id != str(doc["id"]) for r in results)


async def test_delete_nonexistent_document_returns_false(pool):
    deleted = await delete_document(pool, "00000000-0000-0000-0000-000000000000")
    assert deleted is False
