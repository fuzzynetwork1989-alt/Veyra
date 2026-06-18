import httpx

from app.config import get_settings
from app.database import fetch_one
from app.redis_client import get_redis

EMBEDDING_MARKERS = ("embed", "embedding")


def check_postgres() -> dict:
    try:
        row = fetch_one("SELECT 1 AS ok")
        pgvector = fetch_one(
            "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS enabled"
        )
        return {
            "status": "healthy" if row else "unhealthy",
            "pgvector": bool(pgvector and pgvector.get("enabled")),
        }
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
            chat_models = [
                m.get("id", "")
                for m in models
                if m.get("id") and not any(x in m.get("id", "").lower() for x in EMBEDDING_MARKERS)
            ]
            return {"status": "healthy", "models": len(chat_models), "chat_models": chat_models[:5]}
    except Exception as exc:
        return {"status": "unhealthy", "error": str(exc)}


def check_embeddings() -> dict:
    settings = get_settings()
    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.get(
                f"{settings.openai_base_url.rstrip('/')}/models",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            )
            response.raise_for_status()
            models = response.json().get("data", [])
            embedding_models = [
                m.get("id", "")
                for m in models
                if m.get("id") and any(x in m.get("id", "").lower() for x in EMBEDDING_MARKERS)
            ]
            configured = settings.openai_embedding_model or None
            if configured:
                status = "healthy"
            elif embedding_models:
                status = "healthy"
                configured = embedding_models[0]
            else:
                status = "degraded"
            return {
                "status": status,
                "configured_model": configured,
                "available_models": embedding_models[:5],
                "hint": "Load an embedding model in LM Studio (e.g. nomic-embed-text) for semantic RAG",
            }
    except Exception as exc:
        return {"status": "unhealthy", "error": str(exc)}


def full_health() -> dict:
    postgres = check_postgres()
    redis = check_redis()
    llm = check_llm()
    embeddings = check_embeddings()
    components = {
        "postgres": postgres,
        "redis": redis,
        "llm": llm,
        "embeddings": embeddings,
    }
    critical = [postgres, redis, llm]
    overall = (
        "healthy"
        if all(c.get("status") == "healthy" for c in critical)
        and embeddings.get("status") in {"healthy", "degraded"}
        else "degraded"
    )
    return {"status": overall, "service": "veyra-api", "version": "0.3.1", "components": components}