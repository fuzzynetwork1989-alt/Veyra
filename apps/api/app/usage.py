import json
from typing import Any

from app.database import execute


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