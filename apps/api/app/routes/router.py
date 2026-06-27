from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.model_router import VALID_PURPOSES, _list_models, log_decision, select_model
from app.routes.auth import get_current_user

router = APIRouter(prefix="/router", tags=["router"])


@router.get("/models")
async def list_available_models(current_user: dict = Depends(get_current_user)):
    settings = get_settings()
    if settings.mock_llm:
        return {"models": ["veyra-mock-chat", "veyra-mock-embedding"]}
    try:
        models = _list_models(settings.openai_base_url, settings.openai_api_key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach LLM backend: {exc}",
        ) from exc
    return {"models": models}


@router.get("/select")
async def select(
    purpose: str = "chat",
    preferred_model: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    if purpose not in VALID_PURPOSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown purpose '{purpose}'. Valid: {', '.join(VALID_PURPOSES)}",
        )
    try:
        decision = select_model(purpose, preferred_model=preferred_model)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Routing failed: {exc}",
        ) from exc
    log_decision(decision, user_id=current_user["user_id"])
    return decision.to_dict()
