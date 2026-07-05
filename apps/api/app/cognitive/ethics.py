"""Emotion–ethics control loop — per-message regulatory gate."""

from __future__ import annotations

import json
import re
from typing import Any

from app import llm
from app.cognitive.prompts import ETHICS_PROMPT


DEFAULT_ETHICS: dict[str, Any] = {
    "emotional_state": "neutral",
    "needs": ["clarity"],
    "risk_flags": [],
    "desired_tone": "warm and direct",
    "safety_level": "low",
}


def _parse_ethics_json(text: str) -> dict[str, Any]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return DEFAULT_ETHICS.copy()
    try:
        parsed = json.loads(match.group())
        return {**DEFAULT_ETHICS, **parsed}
    except json.JSONDecodeError:
        return DEFAULT_ETHICS.copy()


async def run_ethics_gate(
    *,
    message: str,
    micro_context: str,
    quality_mode: str | None = None,
) -> dict[str, Any]:
    prompt = (
        f"{ETHICS_PROMPT}\n\n"
        f"Recent context:\n{micro_context[-1500:]}\n\n"
        f"User message: {message}"
    )
    try:
        result = await llm.generate_chat_response(
            message=prompt,
            history=[],
            quality_mode=quality_mode or "fast",
            max_tokens=256,
            temperature=0.2,
        )
        return _parse_ethics_json(result.get("response", ""))
    except Exception:
        return DEFAULT_ETHICS.copy()