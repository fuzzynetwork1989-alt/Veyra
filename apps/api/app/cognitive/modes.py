"""Cognitive surface modes — same brain, different voice weighting."""

from typing import TypedDict


class ModeConfig(TypedDict):
    label: str
    description: str
    selves: list[str]
    weights: dict[str, float]


COGNITIVE_MODES: dict[str, ModeConfig] = {
    "inner_voice": {
        "label": "Inner Voice",
        "description": "Full polyphonic chorus with emotion loop and all time layers.",
        "selves": ["strategist", "empath", "archivist", "challenger", "creator"],
        "weights": {
            "strategist": 1.0,
            "empath": 1.0,
            "archivist": 1.0,
            "challenger": 0.8,
            "creator": 0.9,
        },
    },
    "journal": {
        "label": "Journal",
        "description": "Deeper reflection, macro-time emphasis, inner questions.",
        "selves": ["empath", "archivist", "creator"],
        "weights": {"empath": 1.2, "archivist": 1.1, "creator": 1.0, "strategist": 0.5, "challenger": 0.4},
    },
    "planner": {
        "label": "Planner",
        "description": "Strategist + Challenger weighted; concrete actions.",
        "selves": ["strategist", "challenger", "archivist"],
        "weights": {"strategist": 1.4, "challenger": 1.2, "archivist": 0.9, "empath": 0.6, "creator": 0.5},
    },
    "creator": {
        "label": "Creator Lab",
        "description": "Creator + Empath + cross-domain synthesis.",
        "selves": ["creator", "empath", "strategist"],
        "weights": {"creator": 1.4, "empath": 1.1, "strategist": 0.8, "archivist": 0.7, "challenger": 0.6},
    },
    "standard": {
        "label": "Standard",
        "description": "Classic assistant mode without cognitive orchestration.",
        "selves": [],
        "weights": {},
    },
}


def get_mode(mode: str | None) -> ModeConfig:
    key = (mode or "inner_voice").lower()
    return COGNITIVE_MODES.get(key, COGNITIVE_MODES["inner_voice"])