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
