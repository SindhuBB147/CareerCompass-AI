from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


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
    ):
        """Default streaming implementation: yield the full text as one
        chunk. Real streaming providers override this with token deltas.
        """
        result = await self.generate(system_prompt, history, user_query)
        yield result.text
