"""Hierarchical time mind: micro, meso, macro layers."""

from __future__ import annotations

from typing import Any

from app.cognitive_memory import get_latest_meso_summary, get_or_create_profile


def build_micro_context(history: list[dict[str, str]], message: str) -> str:
    recent = history[-6:] if history else []
    if not recent:
        return f"User message: {message}"
    lines = [f"{m['role']}: {m['content'][:300]}" for m in recent]
    lines.append(f"user (now): {message}")
    return "\n".join(lines)


def build_meso_context(user_id: str) -> str:
    meso = get_latest_meso_summary(user_id)
    if not meso or not meso.get("summary"):
        return "No recent themes consolidated yet."
    themes = meso.get("themes") or []
    theme_text = ", ".join(themes) if themes else "none tagged"
    return f"{meso['summary']}\nRecent themes: {theme_text}"


def build_macro_context(user_id: str) -> str:
    profile = get_or_create_profile(user_id)
    parts: list[str] = []
    if profile.get("macro_profile"):
        parts.append(profile["macro_profile"])
    if profile.get("self_notes"):
        parts.append(f"Veyra self-notes: {profile['self_notes']}")
    return "\n".join(parts) if parts else "Profile not yet consolidated — treat as first deep encounter."


def load_temporal_layers(
    *,
    user_id: str,
    history: list[dict[str, str]],
    message: str,
) -> dict[str, str]:
    return {
        "micro": build_micro_context(history, message),
        "meso": build_meso_context(user_id),
        "macro": build_macro_context(user_id),
    }