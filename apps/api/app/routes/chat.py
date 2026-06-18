import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.llm import generate_chat_response
from app.routes.auth import get_current_user
from app.session_memory import (
    add_message,
    get_messages,
    get_recent_messages_for_prompt,
    get_session_owner,
)

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    session_id: str | None = None
    max_tokens: int | None = Field(default=1024, ge=64, le=4096)
    temperature: float | None = Field(default=0.7, ge=0.0, le=2.0)
    quality_mode: str | None = None
    use_rag: bool = False
    use_agents: bool = False


class ChatResponse(BaseModel):
    response: str
    session_id: str
    tokens_used: int
    model: str
    reasoning_chain: list[str] | None = None
    trace: dict | None = None
    retrieved_docs: list[dict] | None = None


class ChatMessage(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class ChatHistoryResponse(BaseModel):
    session_id: str
    messages: list[ChatMessage]


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    session_id = request.session_id or str(uuid.uuid4())
    user_id = current_user["user_id"]
    owner = get_session_owner(session_id)
    if owner and owner != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this session",
        )

    history = get_recent_messages_for_prompt(session_id)

    try:
        llm_result = await generate_chat_response(
            message=request.message,
            history=history,
            temperature=request.temperature or 0.7,
            max_tokens=request.max_tokens or 1024,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM provider error: {exc}",
        ) from exc

    try:
        add_message(
            session_id=session_id,
            user_id=user_id,
            role="user",
            content=request.message,
        )
        add_message(
            session_id=session_id,
            user_id=user_id,
            role="assistant",
            content=llm_result["response"],
            metadata={"model": llm_result["model"]},
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    return ChatResponse(
        response=llm_result["response"],
        session_id=session_id,
        tokens_used=llm_result["tokens_used"],
        model=llm_result["model"],
        reasoning_chain=llm_result.get("reasoning_chain"),
        trace={
            "request_id": str(uuid.uuid4()),
            "user_id": user_id,
            "session_id": session_id,
            "quality_mode": request.quality_mode,
            "use_rag": request.use_rag,
            "use_agents": request.use_agents,
        },
        retrieved_docs=None,
    )


@router.get("/history", response_model=ChatHistoryResponse)
async def chat_history(
    session_id: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
):
    owner = get_session_owner(session_id)
    if owner and owner != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this session",
        )

    messages = get_messages(session_id)

    return ChatHistoryResponse(
        session_id=session_id,
        messages=[
            ChatMessage(
                id=message["id"],
                role=message["role"],
                content=message["content"],
                created_at=message["createdAt"],
            )
            for message in messages
            if message.get("role") in {"user", "assistant"}
        ],
    )