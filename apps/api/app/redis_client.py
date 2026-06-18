import redis

_redis_client: redis.Redis | None = None


def init_redis(redis_url: str) -> None:
    global _redis_client
    if _redis_client is not None:
        return
    _redis_client = redis.from_url(redis_url, decode_responses=True)


def get_redis() -> redis.Redis:
    if _redis_client is None:
        raise RuntimeError("Redis client is not initialized")
    return _redis_client


def close_redis() -> None:
    global _redis_client
    if _redis_client is not None:
        _redis_client.close()
        _redis_client = None