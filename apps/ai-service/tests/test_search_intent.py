from rag.search_entities import extract_entities
from rag.search_intent import classify_search_intent


def _classify(query: str) -> str:
    return classify_search_intent(query, extract_entities(query)).primary


def test_default_college_search():
    assert _classify("Best CSE colleges under ₹2 lakh") == "search_colleges"


def test_compare_intent():
    assert _classify("Compare RVCE and BMSCE") == "compare_colleges"


def test_scholarship_search_intent():
    assert _classify("Scholarships for SC students") == "search_scholarships"


def test_scholarship_eligibility_intent():
    assert _classify("Which scholarship can I apply?") == "scholarship_eligibility"


def test_predict_admission_from_profile_rank():
    assert _classify("Medical colleges accepting my NEET rank") == "predict_admission"


def test_hostel_only_query_is_find_hostel():
    assert _classify("Which colleges have hostel and transport?") == "find_hostel"


def test_placement_focused_query_without_discipline_is_find_placements():
    assert _classify("Best colleges for placements") == "find_placements"


def test_roi_query_is_financial_planning():
    assert _classify("Best ROI colleges") == "financial_planning"


def test_confidence_is_in_valid_range():
    result = classify_search_intent("Compare RVCE and BMSCE", extract_entities("Compare RVCE and BMSCE"))
    assert 0.0 <= result.confidence <= 1.0
