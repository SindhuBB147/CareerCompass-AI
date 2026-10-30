from dataclasses import dataclass, field
from typing import Dict, List

from rag.search_entities import EntityResult

# Search-routing intent classification — kept separate from rag/intent.py's
# classify_intent(), which biases *document-type retrieval* for the AI
# Counsellor chat (a different concern). Reusing that module's taxonomy here
# would force every new search intent to also make sense as a knowledge-doc
# type hint, which several of these (compare_colleges, predict_admission)
# don't. Only the acronym expansion table is shared (see expand_query below).
SEARCH_INTENTS = [
    "compare_colleges",
    "scholarship_eligibility",
    "search_scholarships",
    "find_fees",
    "find_hostel",
    "find_placements",
    "predict_admission",
    "financial_planning",
    "career_guidance",
    "search_colleges",
]

_ELIGIBILITY_KEYWORDS = ["eligib", "qualify", "which scholarship", "can i apply", "apply for"]
_FEES_KEYWORDS = ["fee", "fees", "cost of", "tuition"]
_FINANCIAL_KEYWORDS = ["loan", "emi", "financial plan", "afford", "budget planning"]
_CAREER_KEYWORDS = ["roadmap", "career path", "career guidance", "skills needed", "career for"]
_PREDICT_KEYWORDS = ["predict", "admission probability", "my chances", "chance of admission", "likely to get"]


@dataclass
class SearchIntentResult:
    primary: str
    confidence: float
    signals: Dict[str, bool] = field(default_factory=dict)


def classify_search_intent(query: str, entities: EntityResult) -> SearchIntentResult:
    lowered = query.lower()

    if entities.action == "compare" and len(entities.college_names) >= 2:
        return SearchIntentResult("compare_colleges", 0.95, {"action": True})

    if entities.scholarship_focus:
        if any(kw in lowered for kw in _ELIGIBILITY_KEYWORDS):
            return SearchIntentResult("scholarship_eligibility", 0.85, {"scholarship_focus": True, "eligibility": True})
        return SearchIntentResult("search_scholarships", 0.8, {"scholarship_focus": True})

    if entities.use_profile_rank or any(kw in lowered for kw in _PREDICT_KEYWORDS):
        return SearchIntentResult("predict_admission", 0.75, {"use_profile_rank": entities.use_profile_rank})

    if any(kw in lowered for kw in _FINANCIAL_KEYWORDS) or entities.roi_focus:
        return SearchIntentResult("financial_planning", 0.7, {"roi_focus": entities.roi_focus})

    if any(kw in lowered for kw in _FEES_KEYWORDS) and not entities.discipline and not entities.city:
        return SearchIntentResult("find_fees", 0.65, {"fees_keyword": True})

    if entities.hostel_required and not entities.discipline and not entities.placement_focus:
        return SearchIntentResult("find_hostel", 0.65, {"hostel_required": True})

    if entities.placement_focus and not entities.discipline:
        return SearchIntentResult("find_placements", 0.65, {"placement_focus": True})

    if any(kw in lowered for kw in _CAREER_KEYWORDS):
        return SearchIntentResult("career_guidance", 0.7, {"career_keyword": True})

    return SearchIntentResult("search_colleges", 0.5, {"default": True})
