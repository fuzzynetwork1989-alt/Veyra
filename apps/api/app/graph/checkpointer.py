"""Durable checkpoint persistence for the Veyra graph.

LangGraph's in-process ``MemorySaver`` powers recovery within a single run; this
module additionally snapshots state to Postgres at *logical boundaries* (after a
plan is produced, after each critic verdict, and at finalize) so runs can be
replayed and debugged later. All writes are best-effort and never break a run.
"""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Nodes whose output represents a logical boundary worth persisting.
BOUNDARY_NODES = {"plan", "critic", "finalize"}


def _serializable(state: dict[str, Any]) -> dict[str, Any]:
    return json.loads(json.dumps(state, default=str))


def save_checkpoint(thread_id: str, node: str, step: int, state: dict[str, Any]) -> None:
    if not thread_id:
        return
    try:
        from app.database import execute

        execute(
            """
            INSERT INTO graph_checkpoints (thread_id, node, step, state)
            VALUES (%s, %s, %s, %s)
            """,
            (thread_id, node, step, json.dumps(_serializable(state))),
        )
    except Exception as exc:  # pragma: no cover - persistence is best-effort
        logger.debug("Checkpoint persist skipped (%s): %s", node, exc)


def start_run(thread_id: str, goal: str, user_id: str | None, project_id: str | None) -> None:
    try:
        from app.database import execute

        execute(
            """
            INSERT INTO graph_runs (thread_id, user_id, project_id, goal, status)
            VALUES (%s, %s, %s, %s, 'running')
            ON CONFLICT (thread_id) DO NOTHING
            """,
            (thread_id, user_id, project_id, goal),
        )
    except Exception as exc:  # pragma: no cover
        logger.debug("graph_runs start skipped: %s", exc)


def finish_run(thread_id: str, status: str, final_state: dict[str, Any]) -> None:
    try:
        from app.database import execute

        execute(
            """
            UPDATE graph_runs SET status = %s, final_state = %s WHERE thread_id = %s
            """,
            (status, json.dumps(_serializable(final_state)), thread_id),
        )
    except Exception as exc:  # pragma: no cover
        logger.debug("graph_runs finish skipped: %s", exc)


def load_checkpoints(thread_id: str) -> list[dict[str, Any]]:
    """Return the ordered checkpoint trail for a run (for replay/debugging)."""
    from app.database import fetch_all

    return fetch_all(
        """
        SELECT node, step, state, created_at
        FROM graph_checkpoints
        WHERE thread_id = %s
        ORDER BY created_at ASC, step ASC
        """,
        (thread_id,),
    )
