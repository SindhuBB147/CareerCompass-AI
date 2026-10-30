import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

# Rule-based entity extraction for AI Smart Search. Deliberately regex/keyword
# only (no LLM, no DB call) so /search/analyze stays sub-millisecond and can
# sit ahead of every structured Mongo query Nest issues. Vocabulary mirrors
# apps/api/src/modules/colleges/dto/college.dto.ts (KARNATAKA_EXAMS,
# SUPPORTED_DEGREE_TYPES) and college.model.ts (COURSE_DISCIPLINES) — ai-service
# has no Mongo access, so these lists are intentionally duplicated here; keep
# them in sync with those two files if either changes.

EXAM_CODES = ["KCET", "COMEDK", "JEE", "NEET"]

DISCIPLINE_KEYWORDS: Dict[str, List[str]] = {
    "Engineering": [
        "engineering", "engg", "cse", "computer science", "ise", "information science",
        "ece", "electronics", "mechanical", "civil engineering", "robotics",
        "ai & ml", "ai and ml", "artificial intelligence", "machine learning", "data science",
    ],
    "Medical": ["medical", "mbbs", "medicine"],
    "Dental": ["dental", "bds"],
    "Pharmacy": ["pharmacy", "b.pharm", "pharm.d", "pharmd"],
    "Architecture": ["architecture", "b.arch"],
    "Agriculture": ["agriculture", "agricultural"],
    "Veterinary": ["veterinary"],
    "Nursing": ["nursing", "bsc nursing", "b.sc nursing", "b.sc. nursing", "bachelor of nursing", "gnm", "anm", "post basic bsc nursing", "msc nursing", "nursing sciences"],
}

COLLEGE_TYPE_KEYWORDS: Dict[str, List[str]] = {
    "Government": ["government", "govt"],
    "Private": ["private"],
    "Autonomous": ["autonomous"],
    "Deemed": ["deemed"],
}

CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "SC": ["sc student", "sc category", "sc quota", " sc "],
    "ST": ["st student", "st category", "st quota", " st "],
    "OBC": ["obc student", "obc category", "obc quota", " obc "],
    "EWS": ["ews student", "ews category", "ews quota", " ews "],
    "General": ["general category", "general quota", "unreserved"],
}

# Canonical city name <- accepted spelling variants. Karnataka-focused per the
# platform's current dataset (see college.model.ts default state).
CITY_ALIASES: Dict[str, str] = {
    "bangalore": "Bengaluru", "bengaluru": "Bengaluru",
    "mysore": "Mysuru", "mysuru": "Mysuru",
    "mangalore": "Mangaluru", "mangaluru": "Mangaluru",
    "hubli": "Hubli", "hubballi": "Hubli",
    "belgaum": "Belagavi", "belagavi": "Belagavi",
    "davangere": "Davangere", "davanagere": "Davangere",
    "shimoga": "Shivamogga", "shivamogga": "Shivamogga",
    "tumkur": "Tumakuru", "tumakuru": "Tumakuru",
    "gulbarga": "Kalaburagi", "kalaburagi": "Kalaburagi",
    "bijapur": "Vijayapura", "vijayapura": "Vijayapura",
    "udupi": "Udupi", "manipal": "Udupi",
    "hassan": "Hassan", "bellary": "Ballari", "ballari": "Ballari",
    "raichur": "Raichur", "chikmagalur": "Chikmagalur", "dharwad": "Dharwad",
}

# Short-name -> full-name lookup for compare-intent college mentions (mirrors
# rag/intent.py's EXPANSIONS college entries). v1 only resolves these known
# abbreviations plus bare uppercase acronyms found in the raw query; true
# fuzzy/typo-tolerant name matching against the full college corpus is
# deferred (Nest resolves the returned tokens against College.name/aliasNames).
KNOWN_COLLEGE_ABBR: Dict[str, str] = {
    "rvce": "RV College of Engineering",
    "bmsce": "BMS College of Engineering",
    "msrit": "Ramaiah Institute of Technology",
    "pesu": "PES University",
}

_NON_COLLEGE_ACRONYMS = {"KCET", "COMEDK", "NEET", "JEE", "NIRF", "NAAC", "AI", "ML", "ROI", "EMI", "CSE", "ECE", "ISE", "INC", "KSNC", "KNC"}

_BUDGET_RE = re.compile(
    r"(?:under|below|less than|within|up to|max(?:imum)?|budget(?:\s+of)?)\s*"
    r"(₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|crore|cr|k)?",
    re.IGNORECASE,
)
_NIRF_AFTER_RE = re.compile(r"nirf\D{0,15}?(\d+)", re.IGNORECASE)
_NIRF_BEFORE_RE = re.compile(r"(?:top|below|under)\s*(\d+)\D{0,10}nirf", re.IGNORECASE)
_RANK_AFTER_RE = re.compile(r"rank\D{0,15}?(\d{2,7})", re.IGNORECASE)
_RANK_BEFORE_RE = re.compile(r"(\d{2,7})\D{0,15}?rank", re.IGNORECASE)
_ACRONYM_RE = re.compile(r"\b[A-Z]{2,10}\b")

_UNIT_MULTIPLIERS = {
    "lakh": 100_000, "lakhs": 100_000, "lac": 100_000,
    "crore": 10_000_000, "cr": 10_000_000,
    "k": 1_000,
}

_HOSTEL_KEYWORDS = ["hostel", "boarding", "accommodation"]
_PLACEMENT_KEYWORDS = ["placement", "placements", "package", "packages", "recruit", "recruiters"]
_SCHOLARSHIP_KEYWORDS = ["scholarship", "scholarships"]
_ROI_KEYWORDS = ["roi", "return on investment"]
_AFFORDABLE_KEYWORDS = ["affordable", "cheap", "cheapest", "low cost", "low-cost"]
_TOP_KEYWORDS = ["best", "top", "highest"]


@dataclass
class EntityResult:
    exam: Optional[str] = None
    discipline: Optional[str] = None
    college_type: Optional[str] = None
    city: Optional[str] = None
    category: Optional[str] = None
    budget_max: Optional[float] = None
    nirf_max: Optional[int] = None
    rank: Optional[int] = None
    use_profile_rank: bool = False
    hostel_required: bool = False
    placement_focus: bool = False
    scholarship_focus: bool = False
    roi_focus: bool = False
    action: Optional[str] = None  # "compare" | None
    college_names: List[str] = field(default_factory=list)
    sort_hint: Optional[str] = None  # nirf | fees | placement | rating | roi


def _find_keyword(lowered: str, keywords: List[str]) -> bool:
    return any(kw in lowered for kw in keywords)


def _extract_budget(lowered: str) -> Optional[float]:
    match = _BUDGET_RE.search(lowered)
    if not match:
        return None
    currency, amount_str, unit = match.groups()
    if not currency and not unit:
        # Ambiguous bare number ("under 50") — too easy to collide with NIRF/
        # rank thresholds elsewhere in the query, so require an explicit
        # currency symbol or unit before treating it as a budget figure.
        return None
    amount = float(amount_str)
    if unit:
        amount *= _UNIT_MULTIPLIERS.get(unit.lower(), 1)
    return amount


def _extract_nirf(lowered: str) -> Optional[int]:
    match = _NIRF_AFTER_RE.search(lowered) or _NIRF_BEFORE_RE.search(lowered)
    return int(match.group(1)) if match else None


def _extract_rank(lowered: str, nirf_max: Optional[int]) -> tuple[Optional[int], bool]:
    if nirf_max is not None:
        # "NIRF rank below 50" must not also populate exam rank with 50.
        return None, False
    match = _RANK_AFTER_RE.search(lowered) or _RANK_BEFORE_RE.search(lowered)
    if match:
        return int(match.group(1)), False
    if "rank" in lowered and ("my rank" in lowered or "my neet" in lowered or "my kcet" in lowered
                               or "my comedk" in lowered or "accepting my" in lowered):
        return None, True
    return None, False


def _extract_college_type(lowered: str) -> Optional[str]:
    for label, keywords in COLLEGE_TYPE_KEYWORDS.items():
        if any(re.search(rf"\b{kw}\b", lowered) for kw in keywords):
            return label
    return None


def _extract_discipline(lowered: str) -> Optional[str]:
    for label, keywords in DISCIPLINE_KEYWORDS.items():
        for kw in keywords:
            pattern = kw if " " in kw or "&" in kw else rf"\b{re.escape(kw)}\b"
            if re.search(pattern, lowered):
                return label
    return None


def _extract_city(lowered: str) -> Optional[str]:
    for alias, canonical in CITY_ALIASES.items():
        if re.search(rf"\b{alias}\b", lowered):
            return canonical
    return None


def _extract_category(lowered: str) -> Optional[str]:
    padded = f" {lowered} "
    for label, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in padded for kw in keywords):
            return label
    return None


def _extract_action_and_colleges(query: str, lowered: str) -> tuple[Optional[str], List[str]]:
    if "compare" not in lowered and " vs " not in lowered and " versus " not in lowered:
        return None, []
    names: List[str] = []
    for abbr, full_name in KNOWN_COLLEGE_ABBR.items():
        if re.search(rf"\b{abbr}\b", lowered):
            names.append(full_name)
    for token in _ACRONYM_RE.findall(query):
        if token.upper() in _NON_COLLEGE_ACRONYMS or token.lower() in KNOWN_COLLEGE_ABBR:
            continue
        names.append(token)
    # De-dupe while preserving order.
    seen = set()
    deduped = [n for n in names if not (n in seen or seen.add(n))]
    return "compare", deduped


def _extract_sort_hint(lowered: str, roi_focus: bool, placement_focus: bool) -> Optional[str]:
    if roi_focus:
        return "roi"
    if any(kw in lowered for kw in _AFFORDABLE_KEYWORDS):
        return "fees"
    if placement_focus and any(kw in lowered for kw in _TOP_KEYWORDS):
        return "placement"
    if "nirf" in lowered and any(kw in lowered for kw in _TOP_KEYWORDS):
        return "nirf"
    return None


def extract_entities(query: str) -> EntityResult:
    lowered = query.lower()
    nirf_max = _extract_nirf(lowered)
    rank, use_profile_rank = _extract_rank(lowered, nirf_max)
    placement_focus = _find_keyword(lowered, _PLACEMENT_KEYWORDS)
    roi_focus = _find_keyword(lowered, _ROI_KEYWORDS)
    action, college_names = _extract_action_and_colleges(query, lowered)

    return EntityResult(
        exam=next((code for code in EXAM_CODES if re.search(rf"\b{code.lower()}\b", lowered)), None),
        discipline=_extract_discipline(lowered),
        college_type=_extract_college_type(lowered),
        city=_extract_city(lowered),
        category=_extract_category(lowered),
        budget_max=_extract_budget(lowered),
        nirf_max=nirf_max,
        rank=rank,
        use_profile_rank=use_profile_rank,
        hostel_required=_find_keyword(lowered, _HOSTEL_KEYWORDS),
        placement_focus=placement_focus,
        scholarship_focus=_find_keyword(lowered, _SCHOLARSHIP_KEYWORDS),
        roi_focus=roi_focus,
        action=action,
        college_names=college_names,
        sort_hint=_extract_sort_hint(lowered, roi_focus, placement_focus),
    )
