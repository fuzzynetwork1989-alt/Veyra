import json
from typing import Any

from app.config import get_settings
from app.redis_client import get_redis

QUOTA_KEY = "veyra:quotas:global"


def get_effective_quotas() -> dict[str, int]:
    settings = get_settings()
    quotas = {
        "tokens": settings.daily_token_quota,
        "chats": settings.daily_chat_quota,
        "tasks": settings.daily_task_quota,
    }
    try:
        raw = get_redis().get(QUOTA_KEY)
        if raw:
            overrides = json.loads(raw)
            for key in ("tokens", "chats", "tasks"):
                if key in overrides and overrides[key] is not None:
                    quotas[key] = int(overrides[key])
    except Exception:
        pass
    return quotas


def set_global_quotas(*, tokens: int | None = None, chats: int | None = None, tasks: int | None = None) -> dict[str, int]:
    current = get_effective_quotas()
    if tokens is not None:
        current["tokens"] = tokens
    if chats is not None:
        current["chats"] = chats
    if tasks is not None:
        current["tasks"] = tasks
    get_redis().set(QUOTA_KEY, json.dumps(current))
    return current


def get_quota_config() -> dict[str, Any]:
    settings = get_settings()
    effective = get_effective_quotas()
    return {
        "effective": effective,
        "defaults": {
            "tokens": settings.daily_token_quota,
            "chats": settings.daily_chat_quota,
            "tasks": settings.daily_task_quota,
        },
        "source": "redis_override" if get_redis().get(QUOTA_KEY) else "env",
    }