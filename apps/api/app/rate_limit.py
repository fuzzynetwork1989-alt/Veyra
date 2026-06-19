from fastapi import HTTPException, status

from app.redis_client import get_redis

DEFAULT_LIMIT = 120
DEFAULT_WINDOW_SECONDS = 60


def enforce_rate_limit(key: str, limit: int = DEFAULT_LIMIT, window_seconds: int = DEFAULT_WINDOW_SECONDS) -> None:
    from app.config import get_settings

    if get_settings().disable_rate_limits:
        return

    redis = get_redis()
    bucket = f"veyra:rate:{key}"
    count = redis.incr(bucket)
    if count == 1:
        redis.expire(bucket, window_seconds)
    if count > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again shortly.",
        )