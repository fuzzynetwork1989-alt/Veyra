from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/memory", tags=["memory"])


class AddMemoryRequest(BaseModel):
    documents: list[str]
    metadata: dict[str, Any] | None = None


class RetrieveMemoryRequest(BaseModel):
    query: str
    top_k: int = 5


def _retrieve_memory(query: str, top_k: int) -> dict[str, Any]:
    return {
        "results": [],
        "query": query,
        "top_k": top_k,
    }


@router.post("/add")
async def add_memory(request: AddMemoryRequest):
    return {"status": "success", "documents_added": len(request.documents)}


@router.post("/retrieve")
async def retrieve_memory_post(request: RetrieveMemoryRequest):
    return _retrieve_memory(request.query, request.top_k)


@router.get("/retrieve")
async def retrieve_memory_get(query: str, top_k: int = 5):
    return _retrieve_memory(query, top_k)