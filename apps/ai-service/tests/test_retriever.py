from rag.embeddings.local_hash_embeddings import LocalHashEmbeddingProvider
from rag.intent import classify_intent
from rag.retriever import retrieve
from rag.vectorstore import replace_chunks, upsert_document
from schemas import StructuredContextItem


class _FakeSettings:
    retrieval_top_k = 5
    rerank_top_n = 3


async def _seed(pool, embedding_provider, title, text, doc_type="faq"):
    doc, _ = await upsert_document(
        pool, title=title, doc_type=doc_type, source_filename=f"{title}.txt",
        content_hash=f"hash-{title}", content=text, metadata={}, uploaded_by="test",
    )
    embedding = await embedding_provider.embed_one(text)
    await replace_chunks(
        pool, str(doc["id"]),
        [{"text": text, "metadata": {}, "embedding": embedding}],
        embedding_model="local_hash",
    )
    return doc


async def test_structured_context_always_included_and_tagged_first(pool):
    embedding_provider = LocalHashEmbeddingProvider(dimension=1536)
    await _seed(pool, embedding_provider, "RVCE FAQ", "RVCE CSE placements and cutoffs")

    structured = [
        StructuredContextItem(type="college", id="c1", title="RVCE", content="RVCE profile summary"),
    ]
    intent_result = classify_intent("What are my chances at RVCE?")
    result = await retrieve(pool, embedding_provider, _FakeSettings(), "What are my chances at RVCE?", intent_result, structured)

    assert result.items[0].tag == "S1"
    assert result.items[0].source_type == "college"
    assert result.items[0].score == 1.0
    # Document chunk(s) follow, with later tags.
    doc_items = [i for i in result.items if i.source_type == "document"]
    assert len(doc_items) >= 1
    assert doc_items[0].tag != "S1"


async def test_retrieve_with_no_structured_context_still_returns_vector_matches(pool):
    embedding_provider = LocalHashEmbeddingProvider(dimension=1536)
    await _seed(pool, embedding_provider, "Scholarship FAQ", "SC ST scholarship eligibility and deadlines")

    intent_result = classify_intent("What scholarships am I eligible for?")
    result = await retrieve(pool, embedding_provider, _FakeSettings(), "What scholarships am I eligible for?", intent_result, [])

    assert len(result.items) >= 1
    assert all(item.source_type == "document" for item in result.items)


async def test_retrieve_with_empty_knowledge_base_returns_only_structured(pool):
    embedding_provider = LocalHashEmbeddingProvider(dimension=1536)
    structured = [StructuredContextItem(type="financial", id="f1", title="Budget", content="Estimated cost 500000")]
    intent_result = classify_intent("What's the total cost?")
    result = await retrieve(pool, embedding_provider, _FakeSettings(), "What's the total cost?", intent_result, structured)

    assert len(result.items) == 1
    assert result.items[0].source_type == "financial"
