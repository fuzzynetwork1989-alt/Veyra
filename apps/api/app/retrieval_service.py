import json
import re
import uuid
from typing import Any

from app.database import execute, fetch_all, fetch_one
from app.redis_client import get_redis

RETRIEVAL_PREFIX = "veyra:retrieval:"


def _chunk_text(content: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    if len(content) <= chunk_size:
        return [content]
    chunks: list[str] = []
    start = 0
    while start < len(content):
        end = start + chunk_size
        chunks.append(content[start:end])
        if end >= len(content):
            break
        start = max(end - overlap, start + 1)
    return chunks


def _score(query: str, content: str) -> float:
    query_terms = {term for term in re.findall(r"[a-z0-9]+", query.lower()) if len(term) > 2}
    if not query_terms:
        return 0.0
    content_lower = content.lower()
    hits = sum(1 for term in query_terms if term in content_lower)
    return hits / len(query_terms)


def store_document(
    *,
    user_id: str,
    project_id: str,
    filename: str,
    content: str,
    source_type: str = "upload",
) -> dict[str, Any]:
    document_id = str(uuid.uuid4())
    chunks = _chunk_text(content)
    execute(
        """
        INSERT INTO documents (id, project_id, user_id, source_type, content, metadata, chunk_count)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (
            document_id,
            project_id,
            user_id,
            source_type,
            content,
            json.dumps({"filename": filename}),
            len(chunks),
        ),
    )

    redis = get_redis()
    for index, chunk in enumerate(chunks):
        chunk_id = f"{document_id}-chunk-{index}"
        payload = {
            "id": chunk_id,
            "documentId": document_id,
            "projectId": project_id,
            "content": chunk,
            "metadata": {"filename": filename},
        }
        redis.set(f"{RETRIEVAL_PREFIX}{chunk_id}", json.dumps(payload))
        redis.sadd(f"{RETRIEVAL_PREFIX}project:{project_id}", chunk_id)

    return {
        "id": document_id,
        "project_id": project_id,
        "filename": filename,
        "chunk_count": len(chunks),
    }


def retrieve_documents(*, project_id: str, query: str, top_k: int = 5) -> list[dict[str, Any]]:
    redis = get_redis()
    chunk_ids = redis.smembers(f"{RETRIEVAL_PREFIX}project:{project_id}")
    results: list[dict[str, Any]] = []

    for chunk_id in chunk_ids:
        raw = redis.get(f"{RETRIEVAL_PREFIX}{chunk_id}")
        if not raw:
            continue
        payload = json.loads(raw)
        score = _score(query, payload["content"])
        if score <= 0:
            continue
        results.append(
            {
                "content": payload["content"],
                "metadata": payload.get("metadata", {}),
                "distance": 1.0 - score,
                "score": score,
            }
        )

    results.sort(key=lambda item: item["score"], reverse=True)
    if results:
        return results[:top_k]

    rows = fetch_all(
        """
        SELECT content, metadata
        FROM documents
        WHERE project_id = %s AND content ILIKE %s
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (project_id, f"%{query}%", top_k),
    )
    return [
        {
            "content": row["content"][:1000],
            "metadata": row.get("metadata") or {},
            "distance": 0.5,
            "score": 0.5,
        }
        for row in rows
    ]


def list_documents(project_id: str, user_id: str) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT id, project_id, source_type, metadata, chunk_count, created_at
        FROM documents
        WHERE project_id = %s AND user_id = %s
        ORDER BY created_at DESC
        """,
        (project_id, user_id),
    )


def get_project_for_user(project_id: str, user_id: str) -> dict[str, Any] | None:
    return fetch_one(
        "SELECT id, user_id, name, description FROM projects WHERE id = %s AND user_id = %s",
        (project_id, user_id),
    )