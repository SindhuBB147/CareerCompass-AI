import re
from typing import List

from .base import LLMProvider, LlmMessage, LlmResult

_SECTION_HEADING_RE = re.compile(r"^##\s+.+$", re.MULTILINE)
_CONTEXT_HEADING_RE = re.compile(r"^## Context\s*$", re.MULTILINE)


class FallbackTemplateProvider(LLMProvider):
    """Deterministic, no-external-calls provider.

    Used whenever no LLM API key is configured. It does not paraphrase
    freely — it composes an answer strictly from the "## Context" section
    the prompt builder embeds in `system_prompt`, so the grounding
    guarantee holds even without a real model. This keeps the whole
    pipeline (retrieval → prompt → answer → validation → citations)
    exercisable end-to-end with zero external dependencies.
    """

    name = "fallback"

    async def generate(
        self,
        system_prompt: str,
        history: List[LlmMessage],
        user_query: str,
    ) -> LlmResult:
        context_block = self._extract_context(system_prompt)

        if not context_block:
            text = (
                "I don't have verified data on this topic in my knowledge base yet. "
                "I can help with Karnataka engineering admissions — colleges, KCET/COMEDK "
                "cutoffs, placements, fees, scholarships, and the counselling process. "
                "Could you rephrase your question or ask about one of these?"
            )
            return LlmResult(text=text, model="fallback-template", provider=self.name, degraded=True)

        text = (
            f"Based on CareerCompass's verified data:\n\n{context_block}\n\n"
            "This reflects the platform's own records. For the latest official "
            "notifications, always cross-reference the KEA portal (kea.kar.nic.in)."
        )
        return LlmResult(text=text, model="fallback-template", provider=self.name, degraded=True)

    @staticmethod
    def _extract_context(system_prompt: str) -> str:
        # Matches the "## Context" *heading line* (start of line, nothing
        # else on it) — not just the substring, which also appears quoted
        # inside the header's own anti-injection instructions.
        heading = _CONTEXT_HEADING_RE.search(system_prompt)
        if not heading:
            return ""
        rest = system_prompt[heading.end() :]
        next_section = _SECTION_HEADING_RE.search(rest)
        block = rest[: next_section.start()] if next_section else rest
        return block.strip()
