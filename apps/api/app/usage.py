import json
from typing import Any

from fastapi import HTTPException, status

from app.database import execute, fetch_one
from app.quota_settings import get_effective_quotas


def _daily_usage(user_id: str) -> dict[str, int]:
    row = fetch_one(
        """
        SELECT
            COALESCE(SUM(tokens_used), 0) AS tokens,
            COALESCE(SUM(CASE WHEN event_type = 'chat' THEN 1 ELSE 0 END), 0) AS chats,
            COALESCE(SUM(CASE WHEN event_type = 'task' THEN 1 ELSE 0 END), 0) AS tasks
        FROM usage_events
        WHERE user_id = %s
          AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 day'
        """,
        (user_id,),
    )
    return {
        "tokens": int(row["tokens"]) if row else 0,
        "chats": int(row["chats"]) if row else 0,
        "tasks": int(row["tasks"]) if row else 0,
    }


def check_usage_quota(user_id: str, *, event_type: str, tokens: int = 0) -> None:
    limits = get_effective_quotas()
    usage = _daily_usage(user_id)

    if usage["tokens"] + tokens > limits["tokens"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily token quota exceeded ({limits['tokens']})",
        )

    if event_type == "chat" and usage["chats"] >= limits["chats"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily chat quota exceeded ({limits['chats']})",
        )

    if event_type == "task" and usage["tasks"] >= limits["tasks"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily task quota exceeded ({limits['tasks']})",
        )


def record_usage(
    *,
    user_id: str,
    event_type: str,
    tokens_used: int = 0,
    metadata: dict[str, Any] | None = None,
) -> None:
    execute(
        """
        INSERT INTO usage_events (user_id, event_type, tokens_used, metadata)
        VALUES (%s, %s, %s, %s)
        """,
        (user_id, event_type, tokens_used, json.dumps(metadata or {})),
    )


def get_user_usage_summary(user_id: str) -> dict[str, Any]:
    limits = get_effective_quotas()
    usage = _daily_usage(user_id)
    return {
        "user_id": user_id,
        "daily": usage,
        "limits": limits,
    }