from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any
import uuid

router = APIRouter(prefix="/tasks", tags=["tasks"])

class TaskRequest(BaseModel):
    description: str
    context: dict[str, Any] = {}
    priority: str = "medium"

class TaskResponse(BaseModel):
    task_id: str
    status: str
    description: str

@router.post("/execute", response_model=TaskResponse)
async def execute_task(request: TaskRequest):
    task_id = str(uuid.uuid4())
    return TaskResponse(
        task_id=task_id,
        status="pending",
        description=request.description,
    )

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task_status(task_id: str):
    return TaskResponse(
        task_id=task_id,
        status="completed",
        description="Task completed",
    )
