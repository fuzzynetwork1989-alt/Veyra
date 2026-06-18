from datetime import datetime, timezone
from typing import Any

from app.database import execute, fetch_all, fetch_one


def ensure_chat_session(
    *,
    session_id: str,
    user_id: str,
    project_id: str | None,
    title: str | None = None,
) -> dict[str, Any]:
    existing = fetch_one(
        """
        SELECT id, user_id, project_id, title, created_at, updated_at
        FROM chat_sessions
        WHERE id = %s AND user_id = %s
        """,
        (session_id, user_id),
    )
    if existing:
        execute(
            """
            UPDATE chat_sessions
            SET updated_at = %s,
                project_id = COALESCE(%s, project_id),
                title = COALESCE(%s, title)
            WHERE id = %s
            """,
            (datetime.now(timezone.utc), project_id, title, session_id),
        )
        return fetch_one(
            "SELECT id, user_id, project_id, title, created_at, updated_at FROM chat_sessions WHERE id = %s",
            (session_id,),
        ) or existing

    execute(
        """
        INSERT INTO chat_sessions (id, user_id, project_id, title)
        VALUES (%s, %s, %s, %s)
        """,
        (session_id, user_id, project_id, title or "New chat"),
    )
    return fetch_one(
        "SELECT id, user_id, project_id, title, created_at, updated_at FROM chat_sessions WHERE id = %s",
        (session_id,),
    )


def list_chat_sessions(user_id: str, project_id: str | None = None) -> list[dict[str, Any]]:
    if project_id:
        return fetch_all(
            """
            SELECT id, user_id, project_id, title, created_at, updated_at
            FROM chat_sessions
            WHERE user_id = %s AND project_id = %s
            ORDER BY updated_at DESC
            """,
            (user_id, project_id),
        )
    return fetch_all(
        """
        SELECT id, user_id, project_id, title, created_at, updated_at
        FROM chat_sessions
        WHERE user_id = %s
        ORDER BY updated_at DESC
        """,
        (user_id,),
    )