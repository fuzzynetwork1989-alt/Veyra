import json
import uuid
from datetime import datetime, timezone
from typing import Any

from app.redis_client import get_redis

SESSION_PREFIX = "veyra:session:"
SESSION_OWNER_PREFIX = "veyra:session-owner:"
SESSION_TTL_SECONDS = 86400


def _session_key(session_id: str) -> str:
    return f"{SESSION_PREFIX}{session_id}"


def _session_owner_key(session_id: str) -> str:
    return f"{SESSION_OWNER_PREFIX}{session_id}"


def ensure_session_owner(session_id: str, user_id: str) -> None:
    client = get_redis()
    owner_key = _session_owner_key(session_id)
    existing_owner = client.get(owner_key)
    if existing_owner is None:
        client.set(owner_key, user_id, ex=SESSION_TTL_SECONDS)
        return
    if existing_owner != user_id:
        raise PermissionError("Session belongs to another user")


def get_session_owner(session_id: str) -> str | None:
    return get_redis().get(_session_owner_key(session_id))


def add_message(
    *,
    session_id: str,
    user_id: str,
    role: str,
    content: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    entry = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "sessionId": session_id,
        "type": "session",
        "role": role,
        "content": content,
        "metadata": metadata or {},
        "confidence": 1.0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    ensure_session_owner(session_id, user_id)

    client = get_redis()
    key = _session_key(session_id)
    client.hset(key, entry["id"], json.dumps(entry))
    client.expire(key, SESSION_TTL_SECONDS)
    return entry


def get_messages(session_id: str, limit: int = 100) -> list[dict[str, Any]]:
    client = get_redis()
    entries = client.hvals(_session_key(session_id))
    messages = [json.loads(entry) for entry in entries]
    messages.sort(key=lambda item: item["createdAt"])
    return messages[-limit:]


def get_recent_messages_for_prompt(session_id: str, limit: int = 20) -> list[dict[str, str]]:
    messages = []
    for entry in get_messages(session_id, limit=limit):
        role = entry.get("role")
        content = entry.get("content")
        if role in {"user", "assistant", "system"} and content:
            messages.append({"role": role, "content": content})
    return messages