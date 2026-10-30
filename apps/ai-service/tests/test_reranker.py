from rag.reranker import rerank
from rag.vectorstore import VectorSearchResult


def _result(chunk_id, content, doc_type="faq", score=0.5):
    return VectorSearchResult(
        chunk_id=chunk_id, document_id=f"doc-{chunk_id}", document_title="Doc",
        doc_type=doc_type, content=content, metadata={}, score=score,
    )


def test_higher_vector_score_ranks_first_when_keywords_equal():
    results = [
        _result("a", "RVCE placement package details", score=0.4),
        _result("b", "RVCE placement package details", score=0.9),
    ]
    ranked = rerank("RVCE placement", results, preferred_doc_types=[], top_n=5)
    assert ranked[0].result.chunk_id == "b"


def test_keyword_overlap_boosts_lexically_matching_chunk():
    results = [
        _result("a", "completely unrelated content about hostels", score=0.5),
        _result("b", "RVCE CSE cutoff KCET 2025 closing rank", score=0.5),
    ]
    ranked = rerank("RVCE CSE cutoff KCET", results, preferred_doc_types=[], top_n=5)
    assert ranked[0].result.chunk_id == "b"
    assert ranked[0].keyword_score > ranked[1].keyword_score


def test_doc_type_boost_applied_to_preferred_types():
    results = [
        _result("a", "some content", doc_type="general", score=0.5),
        _result("b", "some content", doc_type="scholarship_pdf", score=0.5),
    ]
    ranked = rerank("some content", results, preferred_doc_types=["scholarship_pdf"], top_n=5)
    boosted = next(r for r in ranked if r.result.chunk_id == "b")
    unboosted = next(r for r in ranked if r.result.chunk_id == "a")
    assert boosted.doc_type_boost == 1.0
    assert unboosted.doc_type_boost == 0.0
    assert boosted.final_score > unboosted.final_score


def test_top_n_truncates_results():
    results = [_result(str(i), f"content {i}", score=i / 10) for i in range(10)]
    ranked = rerank("content", results, preferred_doc_types=[], top_n=3)
    assert len(ranked) == 3


def test_negative_vector_score_does_not_go_negative_in_final_score():
    results = [_result("a", "irrelevant text", score=-0.2)]
    ranked = rerank("something else entirely", results, preferred_doc_types=[], top_n=5)
    assert ranked[0].final_score >= 0.0


def test_stopwords_excluded_from_keyword_matching():
    results = [_result("a", "the of for in on to and or what which how", score=0.1)]
    ranked = rerank("the of for in on", results, preferred_doc_types=[], top_n=5)
    assert ranked[0].keyword_score == 0.0
