import re
from typing import List

from rag.retriever import RetrievedItem
from schemas import SourceCitation

_TAG_RE = re.compile(r"\[S(\d+)\]")


def build_citations(answer_text: str, retrieved_items: List[RetrievedItem]) -> List[SourceCitation]:
    by_tag = {item.tag: item for item in retrieved_items}

    cited_tags = {f"S{m.group(1)}" for m in _TAG_RE.finditer(answer_text)}
    # If the model didn't emit citation tags (common with the fallback
    # provider or a model that ignores formatting instructions), default to
    # citing everything that was actually placed in context — under-citing
    # verified data is worse than over-citing it.
    tags_to_cite = cited_tags if cited_tags else set(by_tag.keys())

    citations = []
    for tag in sorted(tags_to_cite, key=lambda t: int(t[1:]) if t[1:].isdigit() else 0):
        item = by_tag.get(tag)
        if not item:
            continue
        snippet = item.content if len(item.content) <= 220 else item.content[:217] + "..."
        citations.append(
            SourceCitation(
                tag=tag,
                source_type=item.source_type,
                source_id=item.source_id,
                title=item.title,
                snippet=snippet,
            )
        )
    return citations
