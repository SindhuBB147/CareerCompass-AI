from rag.citation_service import build_citations
from rag.retriever import RetrievedItem

ITEMS = [
    RetrievedItem(tag="S1", source_type="college", source_id="c1", title="RVCE", content="RVCE CSE closing rank 5000", score=1.0),
    RetrievedItem(tag="S2", source_type="document", source_id="d1", title="Brochure", content="x" * 300, score=0.7),
]


def test_cites_only_tags_present_in_answer():
    citations = build_citations("RVCE's cutoff is around 5000 [S1].", ITEMS)
    assert [c.tag for c in citations] == ["S1"]
    assert citations[0].source_type == "college"


def test_cites_multiple_tags_sorted_numerically():
    citations = build_citations("See [S2] and [S1] for details.", ITEMS)
    assert [c.tag for c in citations] == ["S1", "S2"]


def test_falls_back_to_all_context_when_no_tags_emitted():
    citations = build_citations("RVCE's cutoff is around 5000 with no citation markers.", ITEMS)
    assert {c.tag for c in citations} == {"S1", "S2"}


def test_ignores_tags_not_in_context():
    citations = build_citations("Referencing [S99] which does not exist.", ITEMS)
    assert citations == []


def test_snippet_is_truncated_for_long_content():
    citations = build_citations("[S2]", ITEMS)
    assert len(citations[0].snippet) == 220
    assert citations[0].snippet.endswith("...")


def test_snippet_untouched_for_short_content():
    citations = build_citations("[S1]", ITEMS)
    assert citations[0].snippet == "RVCE CSE closing rank 5000"
