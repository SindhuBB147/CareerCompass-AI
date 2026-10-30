from dataclasses import dataclass
from typing import List

from schemas import ActionButton, StructuredContextItem

_QUESTION_TEMPLATES = {
    "admissions": [
        "Which colleges are safest for my rank?",
        "How does {college} compare on placements?",
        "What's my admission probability at {college}?",
    ],
    "scholarship": [
        "What documents do I need to apply?",
        "What's the application deadline?",
        "Am I eligible for a government scholarship too?",
    ],
    "financial": [
        "What's the total 4-year cost including hostel?",
        "Can you estimate my education loan EMI?",
        "How does the ROI compare across my shortlisted colleges?",
    ],
    "career": [
        "What skills should I focus on in year 1?",
        "Which certifications matter most for placements?",
        "What does a typical internship timeline look like?",
    ],
    "college_info": [
        "What's the hostel and campus like at {college}?",
        "What's the faculty strength at {college}?",
        "What's {college}'s NIRF ranking?",
    ],
    "process": [
        "What are the KCET counselling rounds?",
        "What documents are required for choice filling?",
        "How does the reservation category affect my rank?",
    ],
    "general": [
        "Which colleges can I get with my KCET rank?",
        "Which branch should I choose?",
        "What scholarships am I eligible for?",
    ],
}

_ACTION_BUTTONS = {
    "admissions": [
        ActionButton(label="Compare Colleges", action="compare_colleges", params={}),
        ActionButton(label="Predict Admission", action="predict_admission", params={}),
        ActionButton(label="Generate Choice List", action="generate_choice_list", params={}),
    ],
    "scholarship": [ActionButton(label="Apply Scholarship", action="apply_scholarship", params={})],
    "financial": [ActionButton(label="Plan My Budget", action="financial_planner", params={})],
    "career": [ActionButton(label="View Career Roadmap", action="view_roadmap", params={})],
    "college_info": [ActionButton(label="Compare Colleges", action="compare_colleges", params={})],
    "process": [ActionButton(label="Generate Choice List", action="generate_choice_list", params={})],
    "general": [
        ActionButton(label="Compare Colleges", action="compare_colleges", params={}),
        ActionButton(label="Predict Admission", action="predict_admission", params={}),
    ],
}


@dataclass
class Suggestions:
    suggested_questions: List[str]
    related_colleges: List[str]
    action_buttons: List[ActionButton]


def _button_params(action: str, structured_context: List[StructuredContextItem]) -> dict:
    """Fills each action button's deep-link params from whatever structured
    context is actually present for this response — e.g. `predict_admission`
    gets the first matched college's id so the frontend can navigate
    straight to that college's prediction instead of a bare list page.
    Returns {} (never None) when no matching context item exists, so the
    button still renders and falls back to a generic list page.
    """
    college_ids = [item.id for item in structured_context if item.type == "college"]
    scholarship_ids = [item.id for item in structured_context if item.type == "scholarship"]

    if action == "compare_colleges" and college_ids:
        return {"collegeIds": ",".join(college_ids[:3])}
    if action in ("predict_admission", "generate_choice_list", "financial_planner") and college_ids:
        return {"collegeId": college_ids[0]}
    if action == "apply_scholarship" and scholarship_ids:
        return {"scholarshipId": scholarship_ids[0]}
    return {}


def build_suggestions(intent: str, structured_context: List[StructuredContextItem]) -> Suggestions:
    related_colleges = []
    seen = set()
    for item in structured_context:
        if item.type == "college" and item.title not in seen:
            related_colleges.append(item.title)
            seen.add(item.title)

    templates = _QUESTION_TEMPLATES.get(intent, _QUESTION_TEMPLATES["general"])
    primary_college = related_colleges[0] if related_colleges else "your shortlisted college"
    questions = [t.format(college=primary_college) for t in templates]

    # Build fresh ActionButton instances per response rather than reusing the
    # shared _ACTION_BUTTONS templates directly — those are module-level
    # singletons, and populating `params` in place on them would leak one
    # request's college/scholarship ids into every concurrent request.
    button_templates = _ACTION_BUTTONS.get(intent, _ACTION_BUTTONS["general"])
    buttons = [
        ActionButton(label=b.label, action=b.action, params=_button_params(b.action, structured_context))
        for b in button_templates
    ]

    return Suggestions(
        suggested_questions=questions,
        related_colleges=related_colleges[:5],
        action_buttons=buttons,
    )
