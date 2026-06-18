from functools import lru_cache
from typing import Any

import httpx

from app.config import get_settings

EMBEDDING_MODEL_MARKERS = ("embed", "embedding")


@lru_cache
def _resolve_embedding_model(base_url: str, api_key: str, configured_model: str) -> str:
    if configured_model:
        return configured_model

    headers = {"Authorization": f"Bearer {api_key}"}
    with httpx.Client(timeout=10.0) as client:
        response = client.get(f"{base_url.rstrip('/')}/models", headers=headers)
        response.raise_for_status()
        models = response.json().get("data", [])

    for model in models:
        model_id = model.get("id", "")
        if model_id and any(marker in model_id.lower() for marker in EMBEDDING_MODEL_MARKERS):
            return model_id

    if models:
        return models[0]["id"]

    raise RuntimeError(f"No embedding models available from LLM server at {base_url}")


def _fit_dimensions(vector: list[float], dimensions: int) -> list[float]:
    if len(vector) == dimensions:
        return vector
    if len(vector) > dimensions:
        return vector[:dimensions]
    return vector + [0.0] * (dimensions - len(vector))


async def generate_embedding(text: str) -> list[float] | None:
    settings = get_settings()
    if not text.strip():
        return None

    try:
        model_id = _resolve_embedding_model(
            settings.openai_base_url,
            settings.openai_api_key,
            settings.openai_embedding_model,
        )
    except Exception:
        return None

    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": model_id,
        "input": text[:8000],
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.openai_base_url.rstrip('/')}/embeddings",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
    except Exception:
        return None

    embedding = data.get("data", [{}])[0].get("embedding")
    if not isinstance(embedding, list) or not embedding:
        return None

    return _fit_dimensions([float(value) for value in embedding], settings.embedding_dimensions)


def embedding_to_pgvector(embedding: list[float]) -> str:
    return "[" + ",".join(f"{value:.8f}" for value in embedding) + "]"