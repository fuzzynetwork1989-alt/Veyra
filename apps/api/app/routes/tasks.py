import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.database import execute, fetch_one
from app.rate_limit import enforce_rate_limit
from app.routes.auth import get_current_user
from app.retrieval_service import get_project_for_user
from app.task_queue import enqueue_task

router = APIRouter(prefix="/tasks", tags=["tasks"])


class TaskRequest(BaseModel):
    description: str = Field(min_length=1, max_length=8000)
    context: dict[str, Any] = {}
    priority: str = "medium"
    project_id: str | None = None


class TaskResponse(BaseModel):
    task_id: str
    status: str
    description: str
    result: dict[str, Any] | None = None
    error: str | None = None
    project_id: str | None = None


@router.post("/execute", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def execute_task(request: TaskRequest, current_user: dict = Depends(get_current_user)):
    enforce_rate_limit(f"tasks:{current_user['user_id']}", limit=30, window_seconds=60)

    if request.project_id and not get_project_for_user(request.project_id, current_user["user_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    task_id = str(uuid.uuid4())
    execute(
        """
        INSERT INTO tasks (id, project_id, user_id, description, status, priority)
        VALUES (%s, %s, %s, %s, 'pending', %s)
        """,
        (
            task_id,
            request.project_id,
            current_user["user_id"],
            request.description,
            request.priority,
        ),
    )

    enqueue_task(
        {
            "id": task_id,
            "userId": current_user["user_id"],
            "projectId": request.project_id,
            "description": request.description,
            "context": request.context,
            "priority": request.priority,
        }
    )

    return TaskResponse(
        task_id=task_id,
        status="pending",
        description=request.description,
        project_id=request.project_id,
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task_status(task_id: str, current_user: dict = Depends(get_current_user)):
    row = fetch_one(
        """
        SELECT id, project_id, description, status, result, error
        FROM tasks
        WHERE id = %s AND user_id = %s
        """,
        (task_id, current_user["user_id"]),
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    result = row.get("result")
    if isinstance(result, str):
        result = json.loads(result)

    return TaskResponse(
        task_id=str(row["id"]),
        status=row["status"],
        description=row["description"],
        result=result,
        error=row.get("error"),
        project_id=str(row["project_id"]) if row.get("project_id") else None,
    )