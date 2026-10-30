from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class LlmMessage:
    role: str  # "user" | "assistant"
    content: str


@dataclass
class LlmResult:
    text: str
    model: str
    tokens_in: int = 0
    tokens_out: int = 0
    provider: str = "unknown"
    degraded: bool = False  # true when the fallback provider had to answer
    error: Optional[str] = None


class LLMProvider(ABC):
    """Generates a grounded answer given a system prompt, prior turns, and
    the current user query. Implementations must never fabricate facts not
    present in the system prompt's supplied context — that instruction is
    baked into the system prompt itself (see rag/prompt_builder.py); the
    provider's job is only to speak to the model.
    """

    name: str = "base"

    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        history: List[LlmMessage],
        user_query: str,
    ) -> LlmResult:
        raise NotImplementedError

    async def generate_stream(
        self,
        system_prompt: str,
        history: List[LlmMessage],
        user_query: str,
        usage_sink: Optional[Dict[str, int]] = None,
    ):
        """Default streaming implementation: yield the full text as one
        chunk. Real streaming providers override this with token deltas.

        `usage_sink`, when given, is filled in-place with `tokens_in`/
        `tokens_out` once available so callers can read it after the
        generator is exhausted (a generator's return value can't carry data
        back to an `async for` caller, so this is the escape hatch).
        """
        result = await self.generate(system_prompt, history, user_query)
        if usage_sink is not None:
            usage_sink["tokens_in"] = result.tokens_in
            usage_sink["tokens_out"] = result.tokens_out
        yield result.text
