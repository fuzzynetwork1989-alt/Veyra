from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.retrieval_service import retrieve_documents
from app.routes.auth import get_current_user

router = APIRouter(prefix="/memory", tags=["memory"])


class AddMemoryRequest(BaseModel):
    documents: list[str]
    metadata: dict[str, Any] | None = None
    project_id: str | None = None


class RetrieveMemoryRequest(BaseModel):
    query: str
    top_k: int = 5
    project_id: str | None = None


def _retrieve_memory(query: str, top_k: int, project_id: str | None) -> dict[str, Any]:
    if not project_id:
        return {"results": [], "query": query, "top_k": top_k}
    results = retrieve_documents(project_id=project_id, query=query, top_k=top_k)
    return {"results": results, "query": query, "top_k": top_k}


@router.post("/add")
async def add_memory(request: AddMemoryRequest):
    return {"status": "success", "documents_added": len(request.documents)}


@router.post("/retrieve")
async def retrieve_memory_post(
    request: RetrieveMemoryRequest,
    current_user: dict = Depends(get_current_user),
):
    return _retrieve_memory(request.query, request.top_k, request.project_id)


@router.get("/retrieve")
async def retrieve_memory_get(
    query: str,
    top_k: int = 5,
    project_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    return _retrieve_memory(query, top_k, project_id)