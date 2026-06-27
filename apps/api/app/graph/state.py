"""Typed state for the Veyra LangGraph runtime."""

from operator import add
from typing import Annotated, Any, TypedDict


class Critique(TypedDict, total=False):
    approved: bool
    score: float
    feedback: str


class VeyraState(TypedDict, total=False):
    """Durable state threaded through the Veyra graph.

    Lists annotated with ``add`` are append-only across nodes so the full trace
    survives loops (execute -> critic -> replan -> execute).
    """

    thread_id: str
    user_id: str | None
    project_id: str | None

    goal: str
    model: str

    plan: list[str]
    current_step: int
    step_results: Annotated[list[dict[str, Any]], add]

    draft: str
    critique: Critique
    retries: int
    replans: int

    final: str
    status: str
    log: Annotated[list[str], add]
