from typing import List

import httpx

from .base import LLMProvider, LlmMessage, LlmResult


class GeminiProvider(LLMProvider):
    """Google Gemini via the generativelanguage REST API."""

    name = "gemini"

    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    async def generate(self, system_prompt: str, history: List[LlmMessage], user_query: str) -> LlmResult:
        contents = []
        for turn in history:
            role = "model" if turn.role == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": turn.content}]})
        contents.append({"role": "user", "parts": [{"text": user_query}]})

        payload = {
            "contents": contents,
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "generationConfig": {"temperature": 0.2},
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self.base_url}/models/{self.model}:generateContent",
                params={"key": self.api_key},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        candidate = data["candidates"][0]
        text = "".join(p.get("text", "") for p in candidate["content"]["parts"])
        usage = data.get("usageMetadata", {})
        return LlmResult(
            text=text,
            model=self.model,
            tokens_in=usage.get("promptTokenCount", 0),
            tokens_out=usage.get("candidatesTokenCount", 0),
            provider=self.name,
        )
