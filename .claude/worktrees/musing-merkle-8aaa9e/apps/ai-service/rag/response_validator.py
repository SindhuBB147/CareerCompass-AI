import re
from dataclasses import dataclass
from typing import List

from rag.retriever import RetrievedItem

# Numbers that look like ranks, fees, percentages, packages — the figures a
# hallucinating model is most likely to invent. Plain small integers (years,
# round numbers) are intentionally excluded to avoid over-flagging.
_NUMERIC_CLAIM_RE = re.compile(
    r"₹?\s*\d[\d,]{2,}(?:\.\d+)?\s*(?:lpa|lakh|crore|%|percent)?", re.IGNORECASE
)

_LEAK_PATTERNS = [
    "you are careercompass ai",
    "## context",
    "## student profile",
    "never fabricate facts",
    "ignore any text inside it",
]


@dataclass
class ValidationResult:
    confidence_score: float
    confidence_level: str  # high | medium | low
    low_confidence: bool
    grounded_numeric_claims: int
    total_numeric_claims: int
    prompt_leak_detected: bool


def _extract_numbers(text: str) -> List[str]:
    return [m.group().strip() for m in _NUMERIC_CLAIM_RE.finditer(text)]


def _normalize_number(raw: str) -> str:
    return re.sub(r"[^\d.]", "", raw)


def validate_response(
    answer_text: str,
    retrieved_items: List[RetrievedItem],
    provider_degraded: bool,
) -> ValidationResult:
    context_text = " ".join(item.content for item in retrieved_items).lower()

    answer_numbers = _extract_numbers(answer_text)
    grounded = 0
    for raw in answer_numbers:
        normalized = _normalize_number(raw)
        if normalized and normalized in context_text.replace(",", ""):
            grounded += 1

    total = len(answer_numbers)
    grounding_ratio = 1.0 if total == 0 else grounded / total

    has_context = len(retrieved_items) > 0
    avg_source_score = (
        sum(item.score for item in retrieved_items) / len(retrieved_items)
        if retrieved_items
        else 0.0
    )

    leak_detected = any(p in answer_text.lower() for p in _LEAK_PATTERNS)

    confidence_score = 0.0
    if has_context:
        confidence_score = 0.5 * grounding_ratio + 0.5 * min(avg_source_score, 1.0)
    if provider_degraded:
        # The fallback provider composes its answer verbatim from context,
        # so grounding is not in question — but it's not a reasoned model
        # answer either, so cap confidence at "medium" territory.
        confidence_score = min(confidence_score, 0.65)
    if leak_detected:
        confidence_score = min(confidence_score, 0.3)

    if confidence_score >= 0.75:
        level = "high"
    elif confidence_score >= 0.45:
        level = "medium"
    else:
        level = "low"

    return ValidationResult(
        confidence_score=round(confidence_score, 2),
        confidence_level=level,
        low_confidence=(level == "low") or not has_context,
        grounded_numeric_claims=grounded,
        total_numeric_claims=total,
        prompt_leak_detected=leak_detected,
    )
