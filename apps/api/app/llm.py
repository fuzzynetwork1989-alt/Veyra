import json
from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Any

import httpx

from app.config import get_settings

SYSTEM_PROMPT = (
    "You are Veyra, a developer-first AI assistant for planning, building, testing, "
    "deploying, and operating software systems. Be precise, practical, and concise."
)

EMBEDDING_MODEL_MARKERS = ("embed", "embedding")


@lru_cache
def _resolve_model_id(base_url: str, api_key: str, configured_model: str) -> str:
    if configured_model:
        return configured_model

    headers = {"Authorization": f"Bearer {api_key}"}
    with httpx.Client(timeout=10.0) as client:
        response = client.get(f"{base_url.rstrip('/')}/models", headers=headers)
        response.raise_for_status()
        models = response.json().get("data", [])

    for model in models:
        model_id = model.get("id", "")
        if model_id and not any(marker in model_id.lower() for marker in EMBEDDING_MODEL_MARKERS):
            return model_id

    if models:
        return models[0]["id"]

    raise RuntimeError(f"No models available from LLM server at {base_url}")


def _mock_response(*, message: str, history: list[dict[str, str]]) -> dict[str, Any]:
    history_count = len(history)
    return {
        "response": (
            f"[mock] Veyra received: \"{message}\". "
            f"Session has {history_count} prior message(s)."
        ),
        "tokens_used": 12,
        "model": "veyra-mock",
        "reasoning_chain": ["MOCK_LLM enabled"],
    }


async def _mock_stream(*, message: str) -> AsyncIterator[str]:
    text = f"[mock] {message}"
    for token in text.split(" "):
        yield token + " "


async def generate_chat_response(
    *,
    message: str,
    history: list[dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> dict[str, Any]:
    settings = get_settings()
    if settings.mock_llm:
        return _mock_response(message=message, history=history)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}, *history, {"role": "user", "content": message}]

    model_id = _resolve_model_id(
        settings.openai_base_url,
        settings.openai_api_key,
        settings.openai_model,
    )

    payload: dict[str, Any] = {
        "model": model_id,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=float(settings.llm_timeout_seconds)) as client:
            response = await client.post(
                f"{settings.openai_base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        return _fallback_response(
            message=message,
            history=history,
            reason=f"Could not reach LLM at {settings.openai_base_url}: {exc}",
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text
        raise RuntimeError(
            f"LLM request failed ({exc.response.status_code}) at {settings.openai_base_url}: {detail}"
        ) from exc

    choice = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    return {
        "response": choice,
        "tokens_used": usage.get("total_tokens", 0),
        "model": data.get("model", model_id),
        "reasoning_chain": None,
    }


async def stream_chat_response(
    *,
    message: str,
    history: list[dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> AsyncIterator[dict[str, Any]]:
    settings = get_settings()
    if settings.mock_llm:
        async for token in _mock_stream(message=message):
            yield {"type": "token", "content": token}
        yield {"type": "done", "model": "veyra-mock", "tokens_used": 12}
        return

    messages = [{"role": "system", "content": SYSTEM_PROMPT}, *history, {"role": "user", "content": message}]
    model_id = _resolve_model_id(
        settings.openai_base_url,
        settings.openai_api_key,
        settings.openai_model,
    )

    payload: dict[str, Any] = {
        "model": model_id,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }

    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    tokens_used = 0
    model_name = model_id

    try:
        async with httpx.AsyncClient(timeout=float(settings.llm_timeout_seconds)) as client:
            async with client.stream(
                "POST",
                f"{settings.openai_base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data_str = line.removeprefix("data:").strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    model_name = chunk.get("model", model_name)
                    usage = chunk.get("usage")
                    if usage:
                        tokens_used = usage.get("total_tokens", tokens_used)

                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        yield {"type": "token", "content": content}
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        fallback = _fallback_response(
            message=message,
            history=history,
            reason=f"Could not reach LLM at {settings.openai_base_url}: {exc}",
        )
        yield {"type": "token", "content": fallback["response"]}
        yield {
            "type": "done",
            "model": fallback["model"],
            "tokens_used": fallback["tokens_used"],
        }
        return

    yield {"type": "done", "model": model_name, "tokens_used": tokens_used}


def _fallback_response(
    *,
    message: str,
    history: list[dict[str, str]],
    reason: str,
) -> dict[str, Any]:
    history_count = len(history)
    return {
        "response": (
            "Veyra could not reach your local LLM server. "
            f"{reason} "
            f"I received your message: \"{message}\". "
            f"This session currently has {history_count} prior message(s) in memory."
        ),
        "tokens_used": 0,
        "model": "veyra-fallback",
        "reasoning_chain": [
            "Attempted OpenAI-compatible LLM request",
            reason,
            "Returned deterministic local response",
        ],
    }