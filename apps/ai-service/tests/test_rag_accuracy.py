"""Small "golden set" smoke test: ingest a handful of representative
knowledge documents and confirm each of a set of realistic student
questions retrieves the document that actually answers it. This is not a
statistical eval — it's a regression guard against the retrieval/reranking
pipeline silently breaking (e.g. wrong doc_type filter, broken tokenizer).
"""
from rag.embeddings.local_hash_embeddings import LocalHashEmbeddingProvider
from rag.intent import classify_intent
from rag.retriever import retrieve
from rag.vectorstore import replace_chunks, upsert_document

GOLDEN_DOCS = [
    ("RVCE Admissions FAQ", "faq", "RV College of Engineering RVCE Bengaluru. KCET 2025 CSE closing rank was approximately 4950 for General category. NIRF rank 97."),
    ("BMSCE Admissions FAQ", "faq", "BMS College of Engineering BMSCE Bengaluru. KCET 2025 ISE closing rank was approximately 6200 for General category."),
    ("SC ST Scholarship Circular", "scholarship_pdf", "Karnataka SC ST Scholarship provides full fee waiver. Required documents include caste certificate and income certificate. Deadline is October 1."),
    ("KCET Counselling Rules", "admission_rules", "KCET counselling has three rounds. Candidates must exercise choice filling and pay seat acceptance fee within three working days of allotment."),
    ("Placement Report 2025", "placement_report", "Engineering placements across Karnataka colleges averaged 85 percent this year with top recruiters including TCS, Infosys, and Microsoft."),
]

GOLDEN_QUERIES = [
    ("What is the KCET closing rank for CSE at RVCE?", "RVCE Admissions FAQ"),
    ("What documents do I need for the SC ST scholarship?", "SC ST Scholarship Circular"),
    ("How many rounds does KCET counselling have?", "KCET Counselling Rules"),
    ("What was the closing rank for ISE at BMSCE?", "BMSCE Admissions FAQ"),
]


class _FakeSettings:
    retrieval_top_k = 5
    rerank_top_n = 3


async def _seed_golden_set(pool, embedding_provider):
    for title, doc_type, text in GOLDEN_DOCS:
        doc, _ = await upsert_document(
            pool, title=title, doc_type=doc_type, source_filename=f"{title}.txt",
            content_hash=f"hash-{title}", content=text, metadata={}, uploaded_by="test",
        )
        embedding = await embedding_provider.embed_one(text)
        await replace_chunks(
            pool, str(doc["id"]), [{"text": text, "metadata": {}, "embedding": embedding}],
            embedding_model="local_hash",
        )


async def test_golden_queries_retrieve_the_right_document(pool):
    embedding_provider = LocalHashEmbeddingProvider(dimension=1536)
    await _seed_golden_set(pool, embedding_provider)

    hits = 0
    for query, expected_title in GOLDEN_QUERIES:
        intent_result = classify_intent(query)
        result = await retrieve(pool, embedding_provider, _FakeSettings(), query, intent_result, [])
        retrieved_titles = [item.title for item in result.items]
        if expected_title in retrieved_titles:
            hits += 1

    # Hybrid reranking (vector + keyword overlap) over a small, low-noise
    # golden set should recall the right document for the large majority
    # of queries even with the dependency-free local embedding provider.
    recall = hits / len(GOLDEN_QUERIES)
    assert recall >= 0.75, f"Golden-set recall too low: {hits}/{len(GOLDEN_QUERIES)}"
