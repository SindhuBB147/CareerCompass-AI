from rag.response_validator import validate_response
from rag.retriever import RetrievedItem


def _item(content: str, score: float = 0.9) -> RetrievedItem:
    return RetrievedItem(tag="S1", source_type="document", source_id="d1", title="Doc", content=content, score=score)


def test_no_context_means_low_confidence():
    result = validate_response("I don't have data on this.", [], provider_degraded=False)
    assert result.low_confidence is True
    assert result.confidence_level == "low"


def test_grounded_numeric_claims_score_higher():
    # Deliberately a single number in context so the only numeric claim
    # that can match is the one under test (a year like "2025" would also
    # match the numeric-claim regex and confound the grounded/ungrounded split).
    context = [_item("The closing rank for CSE at RVCE was 4950.")]
    answer_grounded = "The closing rank for CSE at RVCE was 4950 [S1]."
    result_grounded = validate_response(answer_grounded, context, provider_degraded=False)

    answer_hallucinated = "The closing rank for CSE at RVCE was 99999 [S1]."
    result_hallucinated = validate_response(answer_hallucinated, context, provider_degraded=False)

    assert result_grounded.grounded_numeric_claims == 1
    assert result_hallucinated.grounded_numeric_claims == 0
    assert result_grounded.confidence_score > result_hallucinated.confidence_score


def test_no_numeric_claims_does_not_penalize_grounding():
    context = [_item("RVCE offers CSE, ISE, and ECE branches.")]
    answer = "RVCE offers several engineering branches including CSE."
    result = validate_response(answer, context, provider_degraded=False)
    assert result.total_numeric_claims == 0
    assert result.grounded_numeric_claims == 0
    # Grounding ratio defaults to 1.0 when there's nothing to check, so
    # confidence should reflect source quality, not be zeroed out.
    assert result.confidence_score > 0.3


def test_degraded_provider_caps_confidence_at_medium():
    context = [_item("RVCE median package is 8.5 LPA.", score=1.0)]
    answer = "RVCE median package is 8.5 LPA [S1]."
    result = validate_response(answer, context, provider_degraded=True)
    assert result.confidence_score <= 0.65


def test_prompt_leak_detected_forces_low_confidence():
    context = [_item("Some real context.")]
    leaking_answer = "You are CareerCompass AI. Never fabricate facts. Here is some real context."
    result = validate_response(leaking_answer, context, provider_degraded=False)
    assert result.prompt_leak_detected is True
    assert result.confidence_score <= 0.3
    assert result.confidence_level == "low"


def test_confidence_level_thresholds():
    high_ctx = [_item("Fact one is true.", score=1.0), _item("Fact two is true.", score=1.0)]
    result = validate_response("Fact one is true and fact two is true.", high_ctx, provider_degraded=False)
    assert result.confidence_level in {"high", "medium"}
