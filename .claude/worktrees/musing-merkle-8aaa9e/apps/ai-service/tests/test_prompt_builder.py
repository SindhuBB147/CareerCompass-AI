from rag.prompt_builder import build_history, build_system_prompt
from rag.retriever import RetrievedItem


def test_system_prompt_includes_guardrail_instructions():
    prompt = build_system_prompt({}, [])
    assert "Never fabricate facts" in prompt
    assert "You are CareerCompass AI" in prompt
    assert "## Context" in prompt


def test_system_prompt_serializes_student_profile_fields():
    profile = {"rank": 4500, "category": "General", "budgetMax": 300000}
    prompt = build_system_prompt(profile, [])
    assert "4500" in prompt
    assert "General" in prompt
    assert "300000" in prompt


def test_system_prompt_lists_context_items_with_tags():
    items = [
        RetrievedItem(tag="S1", source_type="college", source_id="c1", title="RVCE", content="RVCE is a top college", score=1.0),
        RetrievedItem(tag="S2", source_type="document", source_id="d1", title="FAQ", content="KCET rounds explained", score=0.8),
    ]
    prompt = build_system_prompt({}, items)
    assert "[S1]" in prompt and "RVCE is a top college" in prompt
    assert "[S2]" in prompt and "KCET rounds explained" in prompt


def test_empty_context_shows_explicit_placeholder_not_blank():
    prompt = build_system_prompt({}, [])
    assert "no relevant data retrieved" in prompt


def test_context_extraction_is_unambiguous_despite_quoted_mention_in_header():
    """Regression test: the header text itself contains the substring
    '## Context' inside a quoted instruction sentence. A naive
    `str.find("## Context")` would match that quoted mention instead of the
    real heading — this caused the fallback provider to echo the system
    prompt's own instructions back to the user instead of retrieved data.
    """
    items = [RetrievedItem(tag="S1", source_type="document", source_id="d1", title="Doc", content="UNIQUE_MARKER_CONTENT", score=0.9)]
    prompt = build_system_prompt({}, items)

    # The real heading must appear on its own line, immediately followed by
    # the actual retrieved content — not the quoted mention inside the
    # guardrail instructions earlier in the prompt.
    assert "\n## Context\n[S1] (document) Doc: UNIQUE_MARKER_CONTENT" in prompt


def test_custom_system_prompt_header_overrides_the_hardcoded_default():
    prompt = build_system_prompt({}, [], system_prompt_header="Custom admin-managed persona.")
    assert prompt.startswith("Custom admin-managed persona.")
    assert "You are CareerCompass AI" not in prompt


def test_blank_or_none_header_falls_back_to_hardcoded_default():
    for header in (None, "", "   "):
        prompt = build_system_prompt({}, [], system_prompt_header=header)
        assert "You are CareerCompass AI" in prompt


def test_build_history_truncates_to_max_turns():
    raw = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"turn {i}"} for i in range(10)]
    history = build_history(raw, max_turns=4, max_chars=10000)
    assert len(history) == 4
    assert history[-1].content == "turn 9"


def test_build_history_respects_char_budget():
    raw = [{"role": "user", "content": "x" * 500} for _ in range(5)]
    history = build_history(raw, max_turns=10, max_chars=800)
    assert len(history) < 5
