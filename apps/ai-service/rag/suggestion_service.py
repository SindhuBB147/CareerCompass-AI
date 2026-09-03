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

    buttons = _ACTION_BUTTONS.get(intent, _ACTION_BUTTONS["general"])

    return Suggestions(
        suggested_questions=questions,
        related_colleges=related_colleges[:5],
        action_buttons=buttons,
    )
