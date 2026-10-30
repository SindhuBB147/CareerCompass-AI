import re
from typing import Dict, List, Optional


class TextChunker:
    """Splits documents into overlapping, paragraph-aware chunks with metadata.

    Paragraphs (blank-line separated) are packed greedily into chunks up to
    ``chunk_size`` words. A paragraph longer than ``chunk_size`` on its own
    is hard-split by words so no chunk ever exceeds the target size. Each
    new chunk is seeded with the last ``chunk_overlap`` words of the
    previous one so retrieval doesn't lose context at a chunk boundary.
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
        current: List[str] = []

        def flush() -> None:
            nonlocal current
            if current:
                chunks_words.append(current)
                current = self._overlap_tail(current)

        for para in paragraphs:
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
                    current.extend(take)
                    i += len(take)
                    if i < len(words):
                        flush()
                continue

            if len(current) + len(words) > self.chunk_size:
                flush()
            current.extend(words)

        if current:
            chunks_words.append(current)

        chunks = []
        for idx, words in enumerate(chunks_words):
            if not words:
                continue
            chunks.append(
                {
                    "text": " ".join(words),
                    "metadata": {**base_metadata, "chunk_index": idx},
                }
            )
        return chunks

    def _overlap_tail(self, words: List[str]) -> List[str]:
        if self.chunk_overlap <= 0:
            return []
        return words[-self.chunk_overlap :]

    @staticmethod
    def _split_paragraphs(text: str) -> List[str]:
        cleaned = text.replace("\r\n", "\n").strip()
        raw_paragraphs = re.split(r"\n\s*\n", cleaned)
        return [p.strip() for p in raw_paragraphs if p.strip()]
