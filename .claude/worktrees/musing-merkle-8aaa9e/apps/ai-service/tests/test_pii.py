from rag.pii import mask_pii


def test_masks_email():
    assert mask_pii("Contact me at student@example.com please") == "Contact me at [EMAIL] please"


def test_masks_indian_mobile_number():
    assert mask_pii("Call me on 9876543210 tomorrow") == "Call me on [PHONE] tomorrow"


def test_masks_indian_mobile_number_with_country_code():
    assert mask_pii("+91 9876543210") == "[PHONE]"


def test_masks_aadhaar_shaped_number():
    assert mask_pii("My Aadhaar is 1234 5678 9012") == "My Aadhaar is [ID]"


def test_masks_multiple_pii_types_in_one_string():
    masked = mask_pii("Email me at a@b.com or call 9876543210")
    assert "[EMAIL]" in masked
    assert "[PHONE]" in masked
    assert "a@b.com" not in masked
    assert "9876543210" not in masked


def test_leaves_non_pii_text_untouched():
    text = "What is the closing rank for RVCE CSE in KCET 2025?"
    assert mask_pii(text) == text


def test_empty_string_returns_empty_string():
    assert mask_pii("") == ""


def test_does_not_mask_short_numbers_like_ranks():
    assert mask_pii("My KCET rank is 5000") == "My KCET rank is 5000"
