from rag.suggestion_service import build_suggestions
from schemas import StructuredContextItem

COLLEGE_CONTEXT = [
    StructuredContextItem(type="college", id="college-1", title="RVCE", content="RVCE details"),
    StructuredContextItem(type="college", id="college-2", title="BMSCE", content="BMSCE details"),
]
SCHOLARSHIP_CONTEXT = [
    StructuredContextItem(type="scholarship", id="sch-1", title="Post-Matric Scholarship", content="details"),
]


def test_related_colleges_deduplicated_and_capped():
    dup_context = COLLEGE_CONTEXT + [COLLEGE_CONTEXT[0]] * 5
    suggestions = build_suggestions("admissions", dup_context)
    assert suggestions.related_colleges == ["RVCE", "BMSCE"]


def test_question_template_fills_college_placeholder():
    suggestions = build_suggestions("admissions", COLLEGE_CONTEXT)
    assert any("RVCE" in q for q in suggestions.suggested_questions)


def test_unknown_intent_falls_back_to_general_templates_and_buttons():
    suggestions = build_suggestions("not_a_real_intent", [])
    assert suggestions.action_buttons[0].action == "compare_colleges"


def test_predict_admission_button_gets_first_college_id():
    suggestions = build_suggestions("admissions", COLLEGE_CONTEXT)
    predict_btn = next(b for b in suggestions.action_buttons if b.action == "predict_admission")
    assert predict_btn.params == {"collegeId": "college-1"}


def test_compare_colleges_button_gets_up_to_three_college_ids():
    suggestions = build_suggestions("admissions", COLLEGE_CONTEXT)
    compare_btn = next(b for b in suggestions.action_buttons if b.action == "compare_colleges")
    assert compare_btn.params == {"collegeIds": "college-1,college-2"}


def test_apply_scholarship_button_gets_scholarship_id():
    suggestions = build_suggestions("scholarship", SCHOLARSHIP_CONTEXT)
    apply_btn = next(b for b in suggestions.action_buttons if b.action == "apply_scholarship")
    assert apply_btn.params == {"scholarshipId": "sch-1"}


def test_button_params_empty_when_no_matching_context():
    suggestions = build_suggestions("admissions", [])
    for button in suggestions.action_buttons:
        assert button.params == {}


def test_no_state_leakage_across_calls():
    """Regression guard: build_suggestions must not mutate the shared
    _ACTION_BUTTONS templates, or one request's college ids would leak into
    every subsequent concurrent request's buttons.
    """
    build_suggestions("admissions", COLLEGE_CONTEXT)
    second = build_suggestions("admissions", [])
    for button in second.action_buttons:
        assert button.params == {}
