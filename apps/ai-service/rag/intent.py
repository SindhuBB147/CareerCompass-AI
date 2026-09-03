import re
from dataclasses import dataclass, field
from typing import Dict, List

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# Rule-based intent classification. Kept simple and inspectable on purpose —
# every "Supported Questions" category in the spec maps to one bucket here,
# and the bucket drives which knowledge-doc types the retriever prioritizes
# plus which suggestion/action-button templates suggestion_service.py uses.
INTENT_KEYWORDS: Dict[str, List[str]] = {
    "admissions": [
        "college", "colleges", "cutoff", "rank", "admission", "admit", "safe",
        "safest", "chance", "chances", "seat", "compare", "counselling",
        "counseling", "branch", "choice", "option entry", "reservation",
    ],
    "scholarship": [
        "scholarship", "scholarships", "qualify", "eligible", "eligibility",
        "document", "documents", "deadline", "award", "waiver",
    ],
    "financial": [
        "fee", "fees", "cost", "hostel", "loan", "emi", "roi", "budget",
        "expense", "expenses", "afford", "tuition", "mess",
    ],
    "career": [
        "skill", "skills", "certification", "certifications", "internship",
        "placement prep", "career", "roadmap", "job", "interview",
    ],
    "college_info": [
        "faculty", "hostel", "facilities", "facility", "ranking", "rankings",
        "campus", "infrastructure", "nirf", "naac",
    ],
    "process": [
        "admission process", "counselling process", "documents required",
        "reservation rules", "choice filling", "kea", "process",
    ],
}

# Query expansion: acronyms/shorthand common in Karnataka admissions that a
# naive lexical or hashed-embedding match would otherwise miss.
EXPANSIONS: Dict[str, str] = {
    "kcet": "karnataka common entrance test kea",
    "comedk": "consortium of medical engineering and dental colleges of karnataka",
    "jee": "joint entrance examination nta",
    "neet": "national eligibility cum entrance test",
    "cse": "computer science engineering",
    "ise": "information science engineering",
    "ece": "electronics and communication engineering",
    "me": "mechanical engineering",
    "ce": "civil engineering",
    "nirf": "national institutional ranking framework",
    "naac": "national assessment and accreditation council",
    "roi": "return on investment",
    "emi": "equated monthly installment",
    "rvce": "rv college of engineering",
    "bmsce": "bms college of engineering",
    "msrit": "ramaiah institute of technology",
    "pesu": "pes university",
}


@dataclass
class IntentResult:
    primary: str
    scores: Dict[str, int] = field(default_factory=dict)
    expanded_query: str = ""


def classify_intent(query: str) -> IntentResult:
    lowered = query.lower()
    scores: Dict[str, int] = {}
    for intent, keywords in INTENT_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in lowered)
        if count:
            scores[intent] = count

    if not scores:
        return IntentResult(primary="general", scores={}, expanded_query=expand_query(query))

    primary = max(scores, key=scores.get)
    return IntentResult(primary=primary, scores=scores, expanded_query=expand_query(query))


def expand_query(query: str) -> str:
    tokens = set(_TOKEN_RE.findall(query.lower()))
    additions = [EXPANSIONS[t] for t in tokens if t in EXPANSIONS]
    if not additions:
        return query
    return f"{query} {' '.join(additions)}"


# Maps intent -> preferred knowledge_documents.doc_type values, used to
# softly bias vector search (see rag/vectorstore.py doc_type_boost).
INTENT_DOC_TYPE_HINTS: Dict[str, List[str]] = {
    "admissions": ["admission_rules", "brochure", "faq"],
    "scholarship": ["scholarship_pdf", "circular", "faq"],
    "financial": ["brochure", "circular", "faq"],
    "career": ["placement_report", "brochure", "faq"],
    "college_info": ["brochure", "placement_report", "faq"],
    "process": ["admission_rules", "circular", "faq"],
    "general": [],
}
