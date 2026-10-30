import re
from typing import Dict, List, Optional

_PAGE_MARKER_RE = re.compile(r"^\[\[PAGE:(\d+)\]\]$")


class TextChunker:
    """Splits documents into overlapping, paragraph-aware chunks with metadata.

    Paragraphs (blank-line separated) are packed greedily into chunks up to
    ``chunk_size`` words. A paragraph longer than ``chunk_size`` on its own
    is hard-split by words so no chunk ever exceeds the target size. Each
    new chunk is seeded with the last ``chunk_overlap`` words of the
    previous one so retrieval doesn't lose context at a chunk boundary.

    A paragraph consisting solely of a ``[[PAGE:n]]`` marker (see
    ``document_processor._extract_pdf``) updates the current page instead
    of being treated as content, so each resulting chunk can carry the
    page number(s) it was drawn from.
    """

    def __init__(self, chunk_size: int = 300, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_text(self, text: str, metadata: Optional[Dict] = None) -> List[Dict]:
        base_metadata = metadata or {}
        paragraphs = self._split_paragraphs(text)
        if not paragraphs:
            return []

        chunks_words: List[List[str]] = []
        chunks_pages: List[List[Optional[int]]] = []
        current: List[str] = []
        # Parallel to `current`, one entry per word, so overlap tails carry
        # the *actual* page each word came from — not whatever marker was
        # most recently seen, which can have already advanced past a page
        # boundary that falls inside the tail.
        current_pages: List[Optional[int]] = []
        current_page: Optional[int] = None

        def flush() -> None:
            nonlocal current, current_pages
            if current:
                chunks_words.append(current)
                chunks_pages.append(current_pages)
                current = self._overlap_tail(current)
                current_pages = self._overlap_tail(current_pages)

        def add(taken_words: List[str]) -> None:
            current.extend(taken_words)
            current_pages.extend([current_page] * len(taken_words))

        for para in paragraphs:
            marker = _PAGE_MARKER_RE.match(para)
            if marker:
                current_page = int(marker.group(1))
                continue

            words = para.split()
            if not words:
                continue

            if len(words) > self.chunk_size:
                # Hard-split an oversized paragraph, continuing from
                # whatever's already pending in `current`.
                i = 0
                while i < len(words):
                    space = self.chunk_size - len(current)
                    if space <= 0:
                        flush()
                        space = self.chunk_size - len(current)
                    take = words[i : i + space]
                    add(take)
                    i += len(take)
                    if i < len(words):
                        flush()
                continue

            if len(current) + len(words) > self.chunk_size:
                flush()
            add(words)

        if current:
            chunks_words.append(current)
            chunks_pages.append(current_pages)

        chunks = []
        for idx, (words, pages) in enumerate(zip(chunks_words, chunks_pages)):
            if not words:
                continue
            chunk_metadata: Dict = {**base_metadata, "chunk_index": idx}
            real_pages = [p for p in pages if p is not None]
            if real_pages:
                page_start, page_end = min(real_pages), max(real_pages)
                if page_start == page_end:
                    chunk_metadata["page_number"] = page_start
                else:
                    chunk_metadata["page_start"] = page_start
                    chunk_metadata["page_end"] = page_end
                    chunk_metadata["page_range"] = f"{page_start}-{page_end}"
            chunks.append({"text": " ".join(words), "metadata": chunk_metadata})
        return chunks

    def _overlap_tail(self, items: List) -> List:
        if self.chunk_overlap <= 0:
            return []
        return items[-self.chunk_overlap :]

    @staticmethod
    def _split_paragraphs(text: str) -> List[str]:
        cleaned = text.replace("\r\n", "\n").strip()
        raw_paragraphs = re.split(r"\n\s*\n", cleaned)
        return [p.strip() for p in raw_paragraphs if p.strip()]
