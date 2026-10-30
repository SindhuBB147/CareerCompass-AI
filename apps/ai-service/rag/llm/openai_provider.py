import json
from typing import AsyncIterator, List, Optional

import httpx

from .base import LLMProvider, LlmMessage, LlmResult


class OpenAiProvider(LLMProvider):
    """OpenAI Chat Completions. Also serves Azure OpenAI when constructed
    with an Azure-shaped `base_url` and `api_version` (the request/response
    JSON is compatible; only the URL and auth header differ).
    """

    name = "openai"

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        base_url: Optional[str] = None,
        api_version: Optional[str] = None,
        is_azure: bool = False,
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/")
        self.api_version = api_version
        self.is_azure = is_azure
        if is_azure:
            self.name = "azure_openai"

    def _url(self, path: str) -> str:
        if self.is_azure:
            sep = "&" if "?" in path else "?"
            return f"{self.base_url}{path}{sep}api-version={self.api_version}"
        return f"{self.base_url}{path}"

    def _headers(self) -> dict:
        if self.is_azure:
            return {"api-key": self.api_key}
        return {"Authorization": f"Bearer {self.api_key}"}

    def _payload(self, system_prompt: str, history: List[LlmMessage], user_query: str, stream: bool) -> dict:
        messages = [{"role": "system", "content": system_prompt}]
        for turn in history:
            messages.append({"role": turn.role, "content": turn.content})
        messages.append({"role": "user", "content": user_query})
        payload = {"messages": messages, "temperature": 0.2, "stream": stream}
        if stream:
            payload["stream_options"] = {"include_usage": True}
        if not self.is_azure:
            payload["model"] = self.model
        return payload

    async def generate(self, system_prompt: str, history: List[LlmMessage], user_query: str) -> LlmResult:
        path = "/chat/completions" if not self.is_azure else f"/openai/deployments/{self.model}/chat/completions"
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                self._url(path), headers=self._headers(), json=self._payload(system_prompt, history, user_query, stream=False)
            )
            resp.raise_for_status()
            data = resp.json()

        choice = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        return LlmResult(
            text=choice,
            model=data.get("model", self.model),
            tokens_in=usage.get("prompt_tokens", 0),
            tokens_out=usage.get("completion_tokens", 0),
            provider=self.name,
        )

    async def generate_stream(
        self,
        system_prompt: str,
        history: List[LlmMessage],
        user_query: str,
        usage_sink: Optional[dict] = None,
    ) -> AsyncIterator[str]:
        path = "/chat/completions" if not self.is_azure else f"/openai/deployments/{self.model}/chat/completions"
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                self._url(path),
                headers=self._headers(),
                json=self._payload(system_prompt, history, user_query, stream=True),
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[len("data:") :].strip()
                    if data == "[DONE]":
                        break
                    try:
                        parsed = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    # With stream_options.include_usage, the final chunk has
                    # an empty/absent `choices` and carries `usage` instead.
                    usage = parsed.get("usage")
                    if usage and usage_sink is not None:
                        usage_sink["tokens_in"] = usage.get("prompt_tokens", 0)
                        usage_sink["tokens_out"] = usage.get("completion_tokens", 0)
                    choices = parsed.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta", {}).get("content")
                    if delta:
                        yield delta
