import json
from typing import Any

from app.redis_client import get_redis

QUEUE_KEY = "veyra:tasks:queue"


def enqueue_task(payload: dict[str, Any]) -> None:
    get_redis().lpush(QUEUE_KEY, json.dumps(payload))