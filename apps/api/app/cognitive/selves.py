"""Polyphonic inner selves — parallel role reasoning."""

from __future__ import annotations

import asyncio
from typing import Any

from app import llm
from app.cognitive.modes import ModeConfig
from app.cognitive.prompts import INNER_SELVES


async def _invoke_self(
    role: str,
    *,
    message: str,
    context_block: str,
    quality_mode: str | None,
) -> dict[str, Any]:
    system = INNER_SELVES[role]
    prompt = f"Context:\n{context_block}\n\nUser message: {message}\n\nYour inner perspective:"
    try:
        result = await llm.generate_chat_response(
            message=prompt,
            history=[{"role": "system", "content": system}],
            quality_mode=quality_mode or "fast",
            max_tokens=200,
            temperature=0.6,
        )
        return {"role": role, "voice": result.get("response", "").strip(), "tokens": result.get("tokens_used", 0)}
    except Exception as exc:
        return {"role": role, "voice": f"[{role} unavailable: {exc}]", "tokens": 0}


async def run_inner_chorus(
    *,
    message: str,
    temporal: dict[str, str],
    mode: ModeConfig,
    quality_mode: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    roles = [r for r in mode["selves"] if r in INNER_SELVES]
    if not roles:
        return [], 0

    context_block = (
        f"Micro: {temporal['micro'][:400]}\n"
        f"Meso: {temporal['meso'][:300]}\n"
        f"Macro: {temporal['macro'][:300]}"
    )

    tasks = [
        _invoke_self(role, message=message, context_block=context_block, quality_mode=quality_mode)
        for role in roles
    ]
    voices = await asyncio.gather(*tasks)
    total_tokens = sum(v.get("tokens", 0) for v in voices)

    weights = mode.get("weights", {})
    weighted = []
    for voice in voices:
        w = weights.get(voice["role"], 1.0)
        weighted.append({**voice, "weight": w})

    return weighted, total_tokens


def format_selves_block(voices: list[dict[str, Any]]) -> str:
    if not voices:
        return "(no inner chorus — standard mode)"
    lines = []
    for v in voices:
        weight = v.get("weight", 1.0)
        lines.append(f"- {v['role'].title()} (weight {weight}): {v['voice']}")
    return "\n".join(lines)