"""Resonant cognitive faculties — route mental skills to capabilities."""

from __future__ import annotations

import re
from typing import Any


FACULTY_PATTERNS: list[tuple[str, str, list[str]]] = [
    ("visual_cortex", "Visual understanding", [r"\b(image|photo|screenshot|picture|diagram)\b"]),
    ("motor_planner", "Action & function planning", [r"\b(deploy|run|execute|call|api|function)\b"]),
    ("symbolic_reasoner", "Deep symbolic reasoning", [r"\b(prove|why|analyze|tradeoff|architecture|design)\b"]),
    ("hippocampus", "Memory recall", [r"\b(remember|recall|last time|previously|history)\b"]),
    ("language_center", "Language generation", []),
    ("code_cortex", "Code & system design", [r"\b(code|bug|refactor|typescript|python|api|sql)\b"]),
]


def select_faculties(message: str, *, use_rag: bool = False) -> list[dict[str, Any]]:
    text = message.lower()
    active: list[dict[str, Any]] = []
    for faculty_id, label, patterns in FACULTY_PATTERNS:
        if any(re.search(p, text) for p in patterns):
            active.append({"id": faculty_id, "label": label, "active": True})
    if use_rag and not any(f["id"] == "hippocampus" for f in active):
        active.append({"id": "hippocampus", "label": "Project memory retrieval", "active": True})
    if not active:
        active.append({"id": "language_center", "label": "Language generation", "active": True})
    return active


def faculties_summary(faculties: list[dict[str, Any]]) -> str:
    return ", ".join(f["label"] for f in faculties)