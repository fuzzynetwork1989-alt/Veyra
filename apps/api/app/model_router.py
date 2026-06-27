"""Intelligent model router.

Selects the most appropriate model for a given purpose from the models exposed
by the OpenAI-compatible backend (LM Studio / Ollama / ...). Selection is a
transparent, heuristic scoring pass over the available model ids so the decision
is explainable and logged for auditing.
"""

import json
import logging
from dataclasses import dataclass, field

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# Supported routing purposes and the substrings that make a model a good fit.
PURPOSE_MARKERS: dict[str, tuple[str, ...]] = {
    "chat": ("instruct", "chat", "it", "assistant"),
    "code": ("coder", "code", "deepseek", "starcoder", "qwen", "codestral"),
    "reasoning": ("reason", "think", "r1", "o1", "o3", "deepseek-r1", "qwq"),
    "embedding": ("embed", "embedding"),
    "critic": ("instruct", "chat", "judge", "reward"),
}

EMBEDDING_MARKERS = ("embed", "embedding")
VALID_PURPOSES = tuple(PURPOSE_MARKERS.keys())


@dataclass
class RouterDecision:
    purpose: str
    selected_model: str
    reason: str
    candidates: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "purpose": self.purpose,
            "selected_model": self.selected_model,
            "reason": self.reason,
            "candidates": self.candidates,
        }


def _list_models(base_url: str, api_key: str) -> list[str]:
    headers = {"Authorization": f"Bearer {api_key}"}
    with httpx.Client(timeout=10.0) as client:
        response = client.get(f"{base_url.rstrip('/')}/models", headers=headers)
        response.raise_for_status()
        data = response.json().get("data", [])
    return [model["id"] for model in data if model.get("id")]


def _score_model(model_id: str, purpose: str) -> int:
    lowered = model_id.lower()
    is_embedding = any(marker in lowered for marker in EMBEDDING_MARKERS)

    # Embeddings and generative purposes must never cross over.
    if purpose == "embedding":
        return 5 if is_embedding else -100
    if is_embedding:
        return -100

    score = 0
    for marker in PURPOSE_MARKERS.get(purpose, ()):  # purpose-specific markers
        if marker in lowered:
            score += 3
    # Mild preference for larger / newer instruct models when nothing else wins.
    for hint, bonus in (("70b", 2), ("32b", 1), ("14b", 1), ("latest", 1)):
        if hint in lowered:
            score += bonus
    return score


def select_model(
    purpose: str = "chat",
    *,
    preferred_model: str | None = None,
    available_models: list[str] | None = None,
) -> RouterDecision:
    """Pick the best model for ``purpose``.

    ``preferred_model`` (e.g. an agent's ``model_preference``) wins when present
    and available. ``available_models`` can be injected for testing.
    """
    purpose = purpose if purpose in PURPOSE_MARKERS else "chat"
    settings = get_settings()

    if settings.mock_llm and available_models is None:
        model = preferred_model or f"veyra-mock-{purpose}"
        return RouterDecision(
            purpose=purpose,
            selected_model=model,
            reason="MOCK_LLM enabled; returning deterministic mock model",
            candidates=[model],
        )

    if available_models is None:
        # An explicitly configured model short-circuits discovery for generation.
        if settings.openai_model and purpose != "embedding":
            available_models = [settings.openai_model]
        elif settings.openai_embedding_model and purpose == "embedding":
            available_models = [settings.openai_embedding_model]
        else:
            available_models = _list_models(settings.openai_base_url, settings.openai_api_key)

    if preferred_model and preferred_model in available_models:
        return RouterDecision(
            purpose=purpose,
            selected_model=preferred_model,
            reason="Used caller/agent preferred model",
            candidates=available_models,
        )

    if not available_models:
        raise RuntimeError("No models available from the LLM backend")

    ranked = sorted(available_models, key=lambda m: _score_model(m, purpose), reverse=True)
    best = ranked[0]
    best_score = _score_model(best, purpose)

    if best_score < 0:
        # No suitable model for this purpose (e.g. no embedding model present).
        raise RuntimeError(f"No model suitable for purpose '{purpose}' among {available_models}")

    reason = (
        f"Selected '{best}' for purpose '{purpose}' (score {best_score}) "
        f"from {len(available_models)} candidate(s)"
    )
    return RouterDecision(purpose=purpose, selected_model=best, reason=reason, candidates=ranked)


def log_decision(decision: RouterDecision, *, user_id: str | None = None, thread_id: str | None = None) -> None:
    """Persist a router decision for auditing. Best-effort; never raises."""
    try:
        from app.database import execute

        execute(
            """
            INSERT INTO router_decisions (user_id, thread_id, purpose, selected_model, candidate_models, reason)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                thread_id,
                decision.purpose,
                decision.selected_model,
                json.dumps(decision.candidates),
                decision.reason,
            ),
        )
    except Exception as exc:  # pragma: no cover - logging must not break routing
        logger.warning("Failed to persist router decision: %s", exc)
