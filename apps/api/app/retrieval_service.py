import json
import math
import re
import uuid
from typing import Any

from app.database import execute, fetch_all, fetch_one
from app.embeddings import embedding_to_pgvector, generate_embedding
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


def _keyword_score(query: str, content: str) -> float:
    query_terms = {term for term in re.findall(r"[a-z0-9]+", query.lower()) if len(term) > 2}
    if not query_terms:
        return 0.0
    content_lower = content.lower()
    hits = sum(1 for term in query_terms if term in content_lower)
    return hits / len(query_terms)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _store_chunks_redis(*, project_id: str, document_id: str, filename: str, chunks: list[str]) -> None:
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


async def _store_chunks_embeddings(
    *,
    project_id: str,
    document_id: str,
    filename: str,
    chunks: list[str],
) -> None:
    for index, chunk in enumerate(chunks):
        embedding = await generate_embedding(chunk)
        metadata = json.dumps({"filename": filename, "chunk_index": index})
        embedding_json = json.dumps(embedding) if embedding else None

        execute(
            """
            INSERT INTO document_chunks (document_id, project_id, chunk_index, content, embedding_json, metadata)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (document_id, project_id, index, chunk, embedding_json, metadata),
        )

        if embedding:
            try:
                execute(
                    """
                    UPDATE document_chunks
                    SET embedding = %s::vector
                    WHERE document_id = %s AND chunk_index = %s
                    """,
                    (embedding_to_pgvector(embedding), document_id, index),
                )
            except Exception:
                pass


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

    _store_chunks_redis(
        project_id=project_id,
        document_id=document_id,
        filename=filename,
        chunks=chunks,
    )

    return {
        "id": document_id,
        "project_id": project_id,
        "filename": filename,
        "chunk_count": len(chunks),
    }


async def store_document_async(
    *,
    user_id: str,
    project_id: str,
    filename: str,
    content: str,
    source_type: str = "upload",
) -> dict[str, Any]:
    document = store_document(
        user_id=user_id,
        project_id=project_id,
        filename=filename,
        content=content,
        source_type=source_type,
    )
    chunks = _chunk_text(content)
    try:
        await _store_chunks_embeddings(
            project_id=project_id,
            document_id=document["id"],
            filename=filename,
            chunks=chunks,
        )
        document["embedding_status"] = "stored"
    except Exception as exc:
        document["embedding_status"] = f"keyword_fallback:{exc}"
    return document


def _retrieve_keyword(*, project_id: str, query: str, top_k: int) -> list[dict[str, Any]]:
    redis = get_redis()
    chunk_ids = redis.smembers(f"{RETRIEVAL_PREFIX}project:{project_id}")
    results: list[dict[str, Any]] = []

    for chunk_id in chunk_ids:
        raw = redis.get(f"{RETRIEVAL_PREFIX}{chunk_id}")
        if not raw:
            continue
        payload = json.loads(raw)
        score = _keyword_score(query, payload["content"])
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


def _retrieve_pgvector(*, project_id: str, query_embedding: list[float], top_k: int) -> list[dict[str, Any]]:
    vector = embedding_to_pgvector(query_embedding)
    rows = fetch_all(
        """
        SELECT content, metadata, (embedding <=> %s::vector) AS distance
        FROM document_chunks
        WHERE project_id = %s AND embedding IS NOT NULL
        ORDER BY embedding <=> %s::vector
        LIMIT %s
        """,
        (vector, project_id, vector, top_k),
    )
    return [
        {
            "content": row["content"],
            "metadata": row.get("metadata") or {},
            "distance": float(row["distance"]),
            "score": max(0.0, 1.0 - float(row["distance"])),
        }
        for row in rows
    ]


def _retrieve_json_embeddings(
    *, project_id: str, query_embedding: list[float], top_k: int
) -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT content, metadata, embedding_json
        FROM document_chunks
        WHERE project_id = %s AND embedding_json IS NOT NULL
        """,
        (project_id,),
    )
    scored: list[dict[str, Any]] = []
    for row in rows:
        embedding = row.get("embedding_json")
        if isinstance(embedding, str):
            embedding = json.loads(embedding)
        if not isinstance(embedding, list):
            continue
        score = _cosine_similarity(query_embedding, [float(v) for v in embedding])
        if score <= 0:
            continue
        scored.append(
            {
                "content": row["content"],
                "metadata": row.get("metadata") or {},
                "distance": 1.0 - score,
                "score": score,
            }
        )

    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[:top_k]


async def retrieve_documents(*, project_id: str, query: str, top_k: int = 5) -> list[dict[str, Any]]:
    query_embedding = await generate_embedding(query)
    if query_embedding:
        try:
            pgvector_results = _retrieve_pgvector(
                project_id=project_id,
                query_embedding=query_embedding,
                top_k=top_k,
            )
            if pgvector_results:
                return pgvector_results
        except Exception:
            pass

        json_results = _retrieve_json_embeddings(
            project_id=project_id,
            query_embedding=query_embedding,
            top_k=top_k,
        )
        if json_results:
            return json_results

    return _retrieve_keyword(project_id=project_id, query=query, top_k=top_k)


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