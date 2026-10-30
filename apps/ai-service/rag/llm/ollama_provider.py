import json
from typing import AsyncIterator, List, Optional

import httpx

from .base import LLMProvider, LlmMessage, LlmResult


class OllamaProvider(LLMProvider):
    """Locally-hosted model via Ollama's `/api/chat` endpoint. Free, private,
    no API key — requires Ollama to be installed and running.
    """

    name = "ollama"

    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.1"):
        self.base_url = base_url.rstrip("/")
        self.model = model

    def _messages(self, system_prompt: str, history: List[LlmMessage], user_query: str) -> list:
        messages = [{"role": "system", "content": system_prompt}]
        for turn in history:
            messages.append({"role": turn.role, "content": turn.content})
        messages.append({"role": "user", "content": user_query})
        return messages

    async def generate(self, system_prompt: str, history: List[LlmMessage], user_query: str) -> LlmResult:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{self.base_url}/api/chat",
                json={"model": self.model, "messages": self._messages(system_prompt, history, user_query), "stream": False},
            )
            resp.raise_for_status()
            data = resp.json()

        return LlmResult(
            text=data.get("message", {}).get("content", ""),
            model=self.model,
            tokens_in=data.get("prompt_eval_count", 0),
            tokens_out=data.get("eval_count", 0),
            provider=self.name,
        )

    async def generate_stream(
        self,
        system_prompt: str,
        history: List[LlmMessage],
        user_query: str,
        usage_sink: Optional[dict] = None,
    ) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={"model": self.model, "messages": self._messages(system_prompt, history, user_query), "stream": True},
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        parsed = json.loads(line)
                        delta = parsed.get("message", {}).get("content")
                        if delta:
                            yield delta
                        if parsed.get("done"):
                            if usage_sink is not None:
                                usage_sink["tokens_in"] = parsed.get("prompt_eval_count", 0)
                                usage_sink["tokens_out"] = parsed.get("eval_count", 0)
                            break
                    except json.JSONDecodeError:
                        continue
