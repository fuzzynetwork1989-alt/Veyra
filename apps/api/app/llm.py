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


async def generate_chat_response(
    *,
    message: str,
    history: list[dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> dict[str, Any]:
    settings = get_settings()
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