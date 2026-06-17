from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any

router = APIRouter(prefix="/memory", tags=["memory"])

class AddMemoryRequest(BaseModel):
    documents: List[str]
    metadata: Dict[str, Any] | None = None

class RetrieveMemoryRequest(BaseModel):
    query: str
    top_k: int = 5

@router.post("/add")
async def add_memory(request: AddMemoryRequest):
    return {"status": "success", "documents_added": len(request.documents)}

@router.post("/retrieve")
async def retrieve_memory(request: RetrieveMemoryRequest):
    return {
        "results": [],
        "query": request.query,
        "top_k": request.top_k,
    }
