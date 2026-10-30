import re

# Applied only before *persisting* logs (retrieval_logs, usage logs) — never
# applied to the live prompt, since personalization needs the real profile.
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_GOVT_ID_RE = re.compile(r"(?<!\d)\d{4}\s?\d{4}\s?\d{4}(?!\d)")  # Aadhaar-shaped


def mask_pii(text: str) -> str:
    if not text:
        return text
    masked = _EMAIL_RE.sub("[EMAIL]", text)
    masked = _PHONE_RE.sub("[PHONE]", masked)
    masked = _GOVT_ID_RE.sub("[ID]", masked)
    return masked
