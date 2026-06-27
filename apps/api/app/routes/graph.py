from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.graph import checkpointer
from app.graph.builder import run_graph
from app.rate_limit import enforce_rate_limit
from app.retrieval_service import get_project_for_user
from app.routes.auth import get_current_user

router = APIRouter(prefix="/graph", tags=["graph"])


class GraphRunRequest(BaseModel):
    goal: str = Field(min_length=1, max_length=8000)
    project_id: str | None = None


class GraphRunResponse(BaseModel):
    thread_id: str
    status: str
    model: str | None = None
    plan: list[str] = []
    final: str | None = None
    critique: dict[str, Any] | None = None
    replans: int = 0
    log: list[str] = []


@router.post("/run", response_model=GraphRunResponse)
async def run(request: GraphRunRequest, current_user: dict = Depends(get_current_user)):
    enforce_rate_limit(f"graph:{current_user['user_id']}", limit=20, window_seconds=60)
    if request.project_id and not get_project_for_user(request.project_id, current_user["user_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    state = await run_graph(
        request.goal,
        user_id=current_user["user_id"],
        project_id=request.project_id,
    )
    return GraphRunResponse(
        thread_id=state["thread_id"],
        status=state.get("status", "completed"),
        model=state.get("model"),
        plan=state.get("plan", []),
        final=state.get("final"),
        critique=state.get("critique"),
        replans=state.get("replans", 0),
        log=state.get("log", []),
    )


@router.get("/runs/{thread_id}/checkpoints")
async def get_checkpoints(thread_id: str, current_user: dict = Depends(get_current_user)):
    run_row = _owned_run(thread_id, current_user["user_id"])
    checkpoints = checkpointer.load_checkpoints(thread_id)
    return {
        "thread_id": thread_id,
        "status": run_row["status"],
        "goal": run_row["goal"],
        "checkpoints": [
            {
                "node": c["node"],
                "step": c["step"],
                "state": c["state"],
                "created_at": c["created_at"],
            }
            for c in checkpoints
        ],
    }


def _owned_run(thread_id: str, user_id: str) -> dict[str, Any]:
    from app.database import fetch_one

    row = fetch_one(
        "SELECT thread_id, user_id, goal, status FROM graph_runs WHERE thread_id = %s",
        (thread_id,),
    )
    if not row or (row.get("user_id") and str(row["user_id"]) != user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return row
