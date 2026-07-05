"""Cognitive OS API — kernel state, dreaming, and trace inspection."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.cognitive.dream import run_dream_cycle
from app.cognitive.modes import COGNITIVE_MODES
from app.cognitive_memory import get_cognitive_state, list_trace_events
from app.rate_limit import enforce_rate_limit
from app.routes.auth import get_current_user

router = APIRouter(prefix="/cognitive", tags=["cognitive"])


class DreamResponse(BaseModel):
    cycle_id: str
    sessions_processed: int
    status: str
    insights_preview: str | None = None
    error: str | None = None


class CognitiveStateResponse(BaseModel):
    profile: dict
    meso: dict
    recent_dreams: list[dict]
    modes: list[dict]


@router.get("/state", response_model=CognitiveStateResponse)
async def cognitive_state(current_user: dict = Depends(get_current_user)):
    state = get_cognitive_state(current_user["user_id"])
    modes = [
        {"id": k, "label": v["label"], "description": v["description"]}
        for k, v in COGNITIVE_MODES.items()
        if k != "standard"
    ]
    return CognitiveStateResponse(**state, modes=modes)


@router.get("/trace")
async def cognitive_trace(
    session_id: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
):
    events = list_trace_events(current_user["user_id"], session_id)
    return {"session_id": session_id, "events": events}


@router.post("/dream", response_model=DreamResponse)
async def trigger_dream(current_user: dict = Depends(get_current_user)):
    enforce_rate_limit(f"dream:{current_user['user_id']}", limit=3, window_seconds=3600)
    result = await run_dream_cycle(current_user["user_id"])
    return DreamResponse(**result)