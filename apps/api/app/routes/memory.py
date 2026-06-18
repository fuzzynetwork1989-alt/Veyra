from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.retrieval_service import get_project_for_user, retrieve_documents, store_document_async
from app.routes.auth import get_current_user

router = APIRouter(prefix="/memory", tags=["memory"])


class AddMemoryRequest(BaseModel):
    documents: list[str] = Field(min_length=1)
    metadata: dict[str, Any] | None = None
    project_id: str | None = None


class RetrieveMemoryRequest(BaseModel):
    query: str
    top_k: int = 5
    project_id: str | None = None


async def _retrieve_memory(query: str, top_k: int, project_id: str | None) -> dict[str, Any]:
    if not project_id:
        return {"results": [], "query": query, "top_k": top_k}
    results = await retrieve_documents(project_id=project_id, query=query, top_k=top_k)
    return {"results": results, "query": query, "top_k": top_k}


@router.post("/add")
async def add_memory(request: AddMemoryRequest, current_user: dict = Depends(get_current_user)):
    if not request.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="project_id is required",
        )

    if not get_project_for_user(request.project_id, current_user["user_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    stored = []
    for index, document in enumerate(request.documents):
        if not document.strip():
            continue
        filename = (request.metadata or {}).get("filename") or f"memory-{index + 1}.txt"
        result = await store_document_async(
            user_id=current_user["user_id"],
            project_id=request.project_id,
            filename=filename,
            content=document,
            source_type="memory",
        )
        stored.append(result)

    return {"status": "success", "documents_added": len(stored), "documents": stored}


@router.post("/retrieve")
async def retrieve_memory_post(
    request: RetrieveMemoryRequest,
    current_user: dict = Depends(get_current_user),
):
    return await _retrieve_memory(request.query, request.top_k, request.project_id)


@router.get("/retrieve")
async def retrieve_memory_get(
    query: str,
    top_k: int = 5,
    project_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    return await _retrieve_memory(query, top_k, project_id)