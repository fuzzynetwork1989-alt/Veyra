import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.chat_sessions import ensure_chat_session, list_chat_sessions
from app.llm import generate_chat_response
from app.rate_limit import enforce_rate_limit
from app.retrieval_service import get_project_for_user, retrieve_documents
from app.routes.auth import get_current_user
from app.session_memory import (
    add_message,
    get_messages,
    get_recent_messages_for_prompt,
    get_session_owner,
)
from app.usage import record_usage

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    session_id: str | None = None
    project_id: str | None = None
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
    latency_ms: int
    reasoning_chain: list[str] | None = None
    trace: dict | None = None
    retrieved_docs: list[dict] | None = None


class ChatMessage(BaseModel):
    id: str
    role: str
    content: str
    created_at: str
    model: str | None = None
    latency_ms: int | None = None


class ChatHistoryResponse(BaseModel):
    session_id: str
    messages: list[ChatMessage]


class ChatSessionSummary(BaseModel):
    id: str
    title: str
    project_id: str | None = None
    updated_at: str


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    enforce_rate_limit(f"chat:{current_user['user_id']}", limit=60, window_seconds=60)

    session_id = request.session_id or str(uuid.uuid4())
    user_id = current_user["user_id"]

    if request.project_id and not get_project_for_user(request.project_id, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    owner = get_session_owner(session_id)
    if owner and owner != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this session")

    ensure_chat_session(
        session_id=session_id,
        user_id=user_id,
        project_id=request.project_id,
        title=request.message[:80],
    )

    history = get_recent_messages_for_prompt(session_id)
    retrieved_docs = None
    augmented_message = request.message

    if request.use_rag and request.project_id:
        retrieved_docs = retrieve_documents(
            project_id=request.project_id,
            query=request.message,
            top_k=5,
        )
        if retrieved_docs:
            context_blocks = "\n\n".join(doc["content"] for doc in retrieved_docs)
            augmented_message = (
                f"Use the following project context when answering.\n\n{context_blocks}\n\n"
                f"User question: {request.message}"
            )

    started = time.perf_counter()
    try:
        llm_result = await generate_chat_response(
            message=augmented_message,
            history=history,
            temperature=request.temperature or 0.7,
            max_tokens=request.max_tokens or 1024,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM provider error: {exc}",
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)

    try:
        add_message(session_id=session_id, user_id=user_id, role="user", content=request.message)
        add_message(
            session_id=session_id,
            user_id=user_id,
            role="assistant",
            content=llm_result["response"],
            metadata={"model": llm_result["model"], "latency_ms": latency_ms},
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    record_usage(
        user_id=user_id,
        event_type="chat",
        tokens_used=llm_result["tokens_used"],
        metadata={
            "session_id": session_id,
            "project_id": request.project_id,
            "model": llm_result["model"],
            "latency_ms": latency_ms,
        },
    )

    return ChatResponse(
        response=llm_result["response"],
        session_id=session_id,
        tokens_used=llm_result["tokens_used"],
        model=llm_result["model"],
        latency_ms=latency_ms,
        reasoning_chain=llm_result.get("reasoning_chain"),
        trace={
            "request_id": str(uuid.uuid4()),
            "user_id": user_id,
            "session_id": session_id,
            "project_id": request.project_id,
            "quality_mode": request.quality_mode,
            "use_rag": request.use_rag,
            "use_agents": request.use_agents,
        },
        retrieved_docs=retrieved_docs,
    )


@router.get("/sessions", response_model=list[ChatSessionSummary])
async def chat_sessions(
    project_id: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    sessions = list_chat_sessions(current_user["user_id"], project_id)
    return [
        ChatSessionSummary(
            id=str(session["id"]),
            title=session["title"],
            project_id=str(session["project_id"]) if session.get("project_id") else None,
            updated_at=session["updated_at"].isoformat(),
        )
        for session in sessions
    ]


@router.get("/history", response_model=ChatHistoryResponse)
async def chat_history(
    session_id: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
):
    owner = get_session_owner(session_id)
    if owner and owner != current_user["user_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this session")

    messages = get_messages(session_id)
    return ChatHistoryResponse(
        session_id=session_id,
        messages=[
            ChatMessage(
                id=message["id"],
                role=message["role"],
                content=message["content"],
                created_at=message["createdAt"],
                model=(message.get("metadata") or {}).get("model"),
                latency_ms=(message.get("metadata") or {}).get("latency_ms"),
            )
            for message in messages
            if message.get("role") in {"user", "assistant"}
        ],
    )