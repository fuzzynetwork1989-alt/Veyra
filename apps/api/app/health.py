import httpx

from app.config import get_settings
from app.database import fetch_one
from app.redis_client import get_redis


def check_postgres() -> dict:
    try:
        row = fetch_one("SELECT 1 AS ok")
        return {"status": "healthy" if row else "unhealthy"}
    except Exception as exc:
        return {"status": "unhealthy", "error": str(exc)}


def check_redis() -> dict:
    try:
        pong = get_redis().ping()
        return {"status": "healthy" if pong else "unhealthy"}
    except Exception as exc:
        return {"status": "unhealthy", "error": str(exc)}


def check_llm() -> dict:
    settings = get_settings()
    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.get(
                f"{settings.openai_base_url.rstrip('/')}/models",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            )
            response.raise_for_status()
            models = response.json().get("data", [])
            return {"status": "healthy", "models": len(models)}
    except Exception as exc:
        return {"status": "unhealthy", "error": str(exc)}


def full_health() -> dict:
    postgres = check_postgres()
    redis = check_redis()
    llm = check_llm()
    components = {"postgres": postgres, "redis": redis, "llm": llm}
    overall = (
        "healthy"
        if all(component.get("status") == "healthy" for component in components.values())
        else "degraded"
    )
    return {"status": overall, "service": "veyra-api", "components": components}