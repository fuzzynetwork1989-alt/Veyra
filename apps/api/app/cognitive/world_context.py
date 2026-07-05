"""Inject world-model entities (agents, tools, relations) into cognitive orchestration."""

from __future__ import annotations

from typing import Any

from app import world_model_service as wm


def load_world_context(user_id: str, project_id: str | None = None) -> dict[str, Any]:
    agents = wm.list_agents(user_id, project_id)
    tools = [t for t in wm.list_tools(user_id, project_id) if t.get("enabled", True)]
    relations = wm.list_relations(user_id)[:20]
    return {
        "agents": agents,
        "tools": tools,
        "relations": relations,
        "summary": format_world_summary(agents, tools, relations),
    }


def format_world_summary(
    agents: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    relations: list[dict[str, Any]],
) -> str:
    if not agents and not tools and not relations:
        return "World model empty — operating with default inner selves only."

    lines: list[str] = []
    if agents:
        lines.append("Registered agents:")
        for a in agents[:8]:
            role = a.get("role") or "generalist"
            lines.append(f"  - {a.get('name')} ({role})")
    if tools:
        lines.append("Available tools:")
        for t in tools[:8]:
            desc = (t.get("description") or "")[:80]
            lines.append(f"  - {t.get('name')}: {desc}")
    if relations:
        lines.append("Active relations:")
        for r in relations[:6]:
            lines.append(
                f"  - {r.get('subject_type')}:{r.get('subject_id')} "
                f"-{r.get('predicate')}-> {r.get('object_type')}:{r.get('object_id')}"
            )
    return "\n".join(lines)


def ensure_default_agents(user_id: str, project_id: str | None = None) -> None:
    """Seed world-model agents mapped to inner selves if none exist."""
    existing = wm.list_agents(user_id, project_id)
    if existing:
        return

    defaults = [
        ("Strategist", "strategist", "Logic, plans, and tradeoffs"),
        ("Empath", "empath", "Emotional safety and tone"),
        ("Archivist", "archivist", "Patterns and memory over time"),
        ("Challenger", "challenger", "Blind spots and assumptions"),
        ("Creator", "creator", "Reframes and creative alternatives"),
    ]
    for name, role, prompt in defaults:
        wm.create_agent(
            user_id,
            name,
            role=role,
            project_id=project_id,
            system_prompt=prompt,
        )