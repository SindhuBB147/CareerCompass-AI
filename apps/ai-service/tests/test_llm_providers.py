import respx
from httpx import Response

from rag.llm.base import LlmMessage
from rag.llm.fallback_provider import FallbackTemplateProvider
from rag.llm.gemini_provider import GeminiProvider
from rag.llm.ollama_provider import OllamaProvider
from rag.llm.openai_provider import OpenAiProvider

HISTORY = [LlmMessage(role="user", content="hi")]


# ── OpenAI ────────────────────────────────────────────────────────────────────

@respx.mock
async def test_openai_generate_returns_text_and_token_usage():
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=Response(200, json={
            "choices": [{"message": {"content": "RVCE's CSE cutoff is around 5000."}}],
            "model": "gpt-4o-mini",
            "usage": {"prompt_tokens": 120, "completion_tokens": 30},
        })
    )
    provider = OpenAiProvider(api_key="sk-test", model="gpt-4o-mini")
    result = await provider.generate("system prompt", HISTORY, "What's RVCE's cutoff?")
    assert result.text == "RVCE's CSE cutoff is around 5000."
    assert result.tokens_in == 120
    assert result.tokens_out == 30
    assert result.provider == "openai"


@respx.mock
async def test_openai_generate_stream_yields_deltas_and_fills_usage_sink():
    body = (
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n'
        'data: {"choices":[],"usage":{"prompt_tokens":15,"completion_tokens":5}}\n\n'
        'data: [DONE]\n\n'
    )
    respx.post("https://api.openai.com/v1/chat/completions").mock(return_value=Response(200, text=body))

    provider = OpenAiProvider(api_key="sk-test", model="gpt-4o-mini")
    usage_sink: dict = {}
    chunks = [c async for c in provider.generate_stream("system", HISTORY, "query", usage_sink=usage_sink)]
    assert "".join(chunks) == "Hello world"
    assert usage_sink == {"tokens_in": 15, "tokens_out": 5}


@respx.mock
async def test_azure_openai_uses_deployment_path_and_api_key_header():
    route = respx.post(
        "https://my-resource.openai.azure.com/openai/deployments/my-deployment/chat/completions"
    ).mock(return_value=Response(200, json={
        "choices": [{"message": {"content": "Azure answer"}}],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1},
    }))
    provider = OpenAiProvider(
        api_key="azure-key", model="my-deployment", base_url="https://my-resource.openai.azure.com",
        api_version="2024-06-01", is_azure=True,
    )
    result = await provider.generate("system", HISTORY, "query")
    assert result.text == "Azure answer"
    assert result.provider == "azure_openai"
    assert route.calls.last.request.headers["api-key"] == "azure-key"


# ── Gemini ────────────────────────────────────────────────────────────────────

@respx.mock
async def test_gemini_generate_returns_text_and_token_usage():
    respx.post("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent").mock(
        return_value=Response(200, json={
            "candidates": [{"content": {"parts": [{"text": "Gemini's answer."}]}}],
            "usageMetadata": {"promptTokenCount": 40, "candidatesTokenCount": 10},
        })
    )
    provider = GeminiProvider(api_key="gm-test", model="gemini-1.5-flash")
    result = await provider.generate("system", HISTORY, "query")
    assert result.text == "Gemini's answer."
    assert result.tokens_in == 40
    assert result.tokens_out == 10


@respx.mock
async def test_gemini_generate_stream_falls_back_to_base_default_and_fills_usage_sink():
    respx.post("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent").mock(
        return_value=Response(200, json={
            "candidates": [{"content": {"parts": [{"text": "full answer"}]}}],
            "usageMetadata": {"promptTokenCount": 3, "candidatesTokenCount": 7},
        })
    )
    provider = GeminiProvider(api_key="gm-test", model="gemini-1.5-flash")
    usage_sink: dict = {}
    chunks = [c async for c in provider.generate_stream("system", HISTORY, "query", usage_sink=usage_sink)]
    assert chunks == ["full answer"]  # base default: one chunk, the whole answer
    assert usage_sink == {"tokens_in": 3, "tokens_out": 7}


# ── Ollama ────────────────────────────────────────────────────────────────────

@respx.mock
async def test_ollama_generate_returns_text_and_token_usage():
    respx.post("http://localhost:11434/api/chat").mock(
        return_value=Response(200, json={
            "message": {"content": "Ollama's answer."},
            "prompt_eval_count": 22, "eval_count": 9,
        })
    )
    provider = OllamaProvider(model="llama3.1")
    result = await provider.generate("system", HISTORY, "query")
    assert result.text == "Ollama's answer."
    assert result.tokens_in == 22
    assert result.tokens_out == 9


@respx.mock
async def test_ollama_generate_stream_yields_deltas_and_fills_usage_sink_from_done_line():
    body = (
        '{"message":{"content":"Hello"}}\n'
        '{"message":{"content":" there"}}\n'
        '{"done":true,"prompt_eval_count":6,"eval_count":4}\n'
    )
    respx.post("http://localhost:11434/api/chat").mock(return_value=Response(200, text=body))

    provider = OllamaProvider(model="llama3.1")
    usage_sink: dict = {}
    chunks = [c async for c in provider.generate_stream("system", HISTORY, "query", usage_sink=usage_sink)]
    assert "".join(chunks) == "Hello there"
    assert usage_sink == {"tokens_in": 6, "tokens_out": 4}


# ── Fallback (no HTTP, no mocking needed) ────────────────────────────────────

async def test_fallback_provider_answers_from_context_block_and_is_degraded():
    system_prompt = (
        "Header text.\n\n## Student Profile\nNo profile.\n\n"
        "## Context\n[S1] (college) RVCE: closing rank 5000."
    )
    provider = FallbackTemplateProvider()
    result = await provider.generate(system_prompt, HISTORY, "Which college can I get?")
    assert "RVCE" in result.text
    assert result.degraded is True
    assert result.provider == "fallback"


async def test_fallback_provider_admits_no_data_when_context_heading_absent():
    system_prompt = "Header text with no context section in this prompt at all."
    provider = FallbackTemplateProvider()
    result = await provider.generate(system_prompt, HISTORY, "Some question")
    assert "don't have verified data" in result.text


async def test_fallback_provider_stream_uses_base_default_and_zero_usage():
    provider = FallbackTemplateProvider()
    usage_sink: dict = {}
    system_prompt = "Header.\n\n## Student Profile\nNone.\n\n## Context\n[S1] (college) X: details."
    chunks = [c async for c in provider.generate_stream(system_prompt, HISTORY, "q", usage_sink=usage_sink)]
    assert len(chunks) == 1
    assert usage_sink == {"tokens_in": 0, "tokens_out": 0}
