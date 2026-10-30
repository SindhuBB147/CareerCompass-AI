from rag.chunker import TextChunker


def test_empty_text_returns_no_chunks():
    assert TextChunker().chunk_text("") == []
    assert TextChunker().chunk_text("   \n\n  ") == []


def test_short_text_is_a_single_chunk():
    chunker = TextChunker(chunk_size=50, chunk_overlap=5)
    chunks = chunker.chunk_text("This is a short paragraph about RVCE admissions.")
    assert len(chunks) == 1
    assert "RVCE" in chunks[0]["text"]
    assert chunks[0]["metadata"]["chunk_index"] == 0


def test_long_text_splits_into_multiple_chunks_with_overlap():
    paragraph = " ".join(f"word{i}" for i in range(120))
    chunker = TextChunker(chunk_size=50, chunk_overlap=10)
    chunks = chunker.chunk_text(paragraph)

    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk["text"].split()) <= 50

    # Overlap: the tail of chunk N should reappear at the head of chunk N+1.
    first_words = chunks[0]["text"].split()
    second_words = chunks[1]["text"].split()
    assert first_words[-10:] == second_words[:10]


def test_metadata_is_preserved_and_indexed():
    chunker = TextChunker(chunk_size=10, chunk_overlap=2)
    text = " ".join(f"w{i}" for i in range(30))
    chunks = chunker.chunk_text(text, metadata={"document_id": "doc-1", "title": "Test"})
    for idx, chunk in enumerate(chunks):
        assert chunk["metadata"]["document_id"] == "doc-1"
        assert chunk["metadata"]["title"] == "Test"
        assert chunk["metadata"]["chunk_index"] == idx


def test_paragraphs_pack_greedily_without_exceeding_chunk_size():
    text = "First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here."
    chunker = TextChunker(chunk_size=100, chunk_overlap=0)
    chunks = chunker.chunk_text(text)
    assert len(chunks) == 1
    assert "First" in chunks[0]["text"] and "Third" in chunks[0]["text"]


def test_never_exceeds_chunk_size_even_with_one_giant_paragraph():
    huge_paragraph = " ".join(f"tok{i}" for i in range(1000))
    chunker = TextChunker(chunk_size=100, chunk_overlap=20)
    chunks = chunker.chunk_text(huge_paragraph)
    assert len(chunks) > 5
    for chunk in chunks:
        assert len(chunk["text"].split()) <= 100


def test_page_marker_tags_chunk_with_single_page_number():
    text = "[[PAGE:1]]\n\nFirst page content here."
    chunker = TextChunker(chunk_size=50, chunk_overlap=0)
    chunks = chunker.chunk_text(text)
    assert len(chunks) == 1
    assert "[[PAGE:1]]" not in chunks[0]["text"]
    assert chunks[0]["metadata"]["page_number"] == 1
    assert "page_range" not in chunks[0]["metadata"]


def test_page_marker_untagged_chunks_have_no_page_metadata():
    chunker = TextChunker(chunk_size=50, chunk_overlap=0)
    chunks = chunker.chunk_text("No page marker in this plain text at all.")
    assert "page_number" not in chunks[0]["metadata"]
    assert "page_range" not in chunks[0]["metadata"]


def test_page_marker_chunk_spanning_two_pages_gets_page_range_not_number():
    # Both pages are large enough (relative to chunk_size) that each gets
    # at least one clean chunk of its own, with a mixed chunk at the
    # boundary between them getting a page_range instead of a page_number.
    page_one = " ".join(f"p1word{i}" for i in range(200))
    page_two = " ".join(f"p2word{i}" for i in range(200))
    text = f"[[PAGE:1]]\n\n{page_one}\n\n[[PAGE:2]]\n\n{page_two}"
    chunker = TextChunker(chunk_size=100, chunk_overlap=10)
    chunks = chunker.chunk_text(text)

    page_numbers = [c["metadata"].get("page_number") for c in chunks]
    page_ranges = [c["metadata"].get("page_range") for c in chunks]
    assert 1 in page_numbers
    assert 2 in page_numbers
    # Somewhere a chunk straddles both pages instead of fabricating a
    # single page for genuinely mixed content.
    assert any(r == "1-2" for r in page_ranges)
