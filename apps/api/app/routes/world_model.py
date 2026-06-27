from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.retrieval_service import get_project_for_user
from app.routes.auth import get_current_user
from app import world_model_service as wm

router = APIRouter(prefix="/world", tags=["world-model"])


def _require_project(project_id: str | None, user_id: str) -> None:
    if project_id and not get_project_for_user(project_id, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


def _sid(row: dict[str, Any], key: str) -> str | None:
    value = row.get(key)
    return str(value) if value is not None else None


# --- Organizations ---------------------------------------------------------

class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None = None
    created_at: datetime | None = None


def _org_out(row: dict[str, Any]) -> OrganizationResponse:
    return OrganizationResponse(
        id=str(row["id"]),
        name=row["name"],
        slug=row["slug"],
        description=row.get("description"),
        created_at=row.get("created_at"),
    )


@router.post("/organizations", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(request: OrganizationCreate, current_user: dict = Depends(get_current_user)):
    row = wm.create_organization(current_user["user_id"], request.name, request.description)
    return _org_out(row)


@router.get("/organizations", response_model=list[OrganizationResponse])
async def list_organizations(current_user: dict = Depends(get_current_user)):
    return [_org_out(row) for row in wm.list_organizations(current_user["user_id"])]


# --- Agents ----------------------------------------------------------------

class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    role: str = "generalist"
    project_id: str | None = None
    system_prompt: str | None = None
    model_preference: str | None = None
    config: dict[str, Any] | None = None


class AgentResponse(BaseModel):
    id: str
    project_id: str | None = None
    name: str
    role: str
    system_prompt: str | None = None
    model_preference: str | None = None
    config: dict[str, Any] | None = None
    status: str
    created_at: datetime | None = None


def _agent_out(row: dict[str, Any]) -> AgentResponse:
    return AgentResponse(
        id=str(row["id"]),
        project_id=_sid(row, "project_id"),
        name=row["name"],
        role=row["role"],
        system_prompt=row.get("system_prompt"),
        model_preference=row.get("model_preference"),
        config=row.get("config"),
        status=row["status"],
        created_at=row.get("created_at"),
    )


@router.post("/agents", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(request: AgentCreate, current_user: dict = Depends(get_current_user)):
    _require_project(request.project_id, current_user["user_id"])
    row = wm.create_agent(
        current_user["user_id"],
        request.name,
        role=request.role,
        project_id=request.project_id,
        system_prompt=request.system_prompt,
        model_preference=request.model_preference,
        config=request.config,
    )
    return _agent_out(row)


@router.get("/agents", response_model=list[AgentResponse])
async def list_agents(project_id: str | None = None, current_user: dict = Depends(get_current_user)):
    return [_agent_out(row) for row in wm.list_agents(current_user["user_id"], project_id)]


@router.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    row = wm.get_agent(agent_id, current_user["user_id"])
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return _agent_out(row)


# --- Artifacts -------------------------------------------------------------

class ArtifactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    artifact_type: str = "text"
    content: str | None = None
    project_id: str | None = None
    task_id: str | None = None
    agent_id: str | None = None
    metadata: dict[str, Any] | None = None


class ArtifactResponse(BaseModel):
    id: str
    project_id: str | None = None
    task_id: str | None = None
    agent_id: str | None = None
    artifact_type: str
    name: str
    content: str | None = None
    metadata: dict[str, Any] | None = None
    created_at: datetime | None = None


def _artifact_out(row: dict[str, Any], *, include_content: bool = True) -> ArtifactResponse:
    return ArtifactResponse(
        id=str(row["id"]),
        project_id=_sid(row, "project_id"),
        task_id=_sid(row, "task_id"),
        agent_id=_sid(row, "agent_id"),
        artifact_type=row["artifact_type"],
        name=row["name"],
        content=row.get("content") if include_content else None,
        metadata=row.get("metadata"),
        created_at=row.get("created_at"),
    )


@router.post("/artifacts", response_model=ArtifactResponse, status_code=status.HTTP_201_CREATED)
async def create_artifact(request: ArtifactCreate, current_user: dict = Depends(get_current_user)):
    _require_project(request.project_id, current_user["user_id"])
    row = wm.create_artifact(
        current_user["user_id"],
        request.name,
        artifact_type=request.artifact_type,
        content=request.content,
        project_id=request.project_id,
        task_id=request.task_id,
        agent_id=request.agent_id,
        metadata=request.metadata,
    )
    return _artifact_out(row)


@router.get("/artifacts", response_model=list[ArtifactResponse])
async def list_artifacts(project_id: str | None = None, current_user: dict = Depends(get_current_user)):
    rows = wm.list_artifacts(current_user["user_id"], project_id)
    return [_artifact_out(row, include_content=False) for row in rows]


@router.get("/artifacts/{artifact_id}", response_model=ArtifactResponse)
async def get_artifact(artifact_id: str, current_user: dict = Depends(get_current_user)):
    row = wm.get_artifact(artifact_id, current_user["user_id"])
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
    return _artifact_out(row)


# --- Tools -----------------------------------------------------------------

class ToolCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    input_schema: dict[str, Any] | None = None
    project_id: str | None = None
    enabled: bool = True


class ToolResponse(BaseModel):
    id: str
    project_id: str | None = None
    name: str
    description: str | None = None
    input_schema: dict[str, Any] | None = None
    enabled: bool
    created_at: datetime | None = None


def _tool_out(row: dict[str, Any]) -> ToolResponse:
    return ToolResponse(
        id=str(row["id"]),
        project_id=_sid(row, "project_id"),
        name=row["name"],
        description=row.get("description"),
        input_schema=row.get("input_schema"),
        enabled=row["enabled"],
        created_at=row.get("created_at"),
    )


@router.post("/tools", response_model=ToolResponse, status_code=status.HTTP_201_CREATED)
async def create_tool(request: ToolCreate, current_user: dict = Depends(get_current_user)):
    _require_project(request.project_id, current_user["user_id"])
    row = wm.create_tool(
        current_user["user_id"],
        request.name,
        description=request.description,
        input_schema=request.input_schema,
        project_id=request.project_id,
        enabled=request.enabled,
    )
    return _tool_out(row)


@router.get("/tools", response_model=list[ToolResponse])
async def list_tools(project_id: str | None = None, current_user: dict = Depends(get_current_user)):
    return [_tool_out(row) for row in wm.list_tools(current_user["user_id"], project_id)]


# --- Relations -------------------------------------------------------------

class RelationCreate(BaseModel):
    subject_type: str
    subject_id: str
    predicate: str
    object_type: str
    object_id: str
    project_id: str | None = None
    metadata: dict[str, Any] | None = None


class RelationResponse(BaseModel):
    id: str
    subject_type: str
    subject_id: str
    predicate: str
    object_type: str
    object_id: str
    metadata: dict[str, Any] | None = None
    created_at: datetime | None = None


def _relation_out(row: dict[str, Any]) -> RelationResponse:
    return RelationResponse(
        id=str(row["id"]),
        subject_type=row["subject_type"],
        subject_id=str(row["subject_id"]),
        predicate=row["predicate"],
        object_type=row["object_type"],
        object_id=str(row["object_id"]),
        metadata=row.get("metadata"),
        created_at=row.get("created_at"),
    )


@router.post("/relations", response_model=RelationResponse, status_code=status.HTTP_201_CREATED)
async def create_relation(request: RelationCreate, current_user: dict = Depends(get_current_user)):
    _require_project(request.project_id, current_user["user_id"])
    row = wm.create_relation(
        current_user["user_id"],
        request.subject_type,
        request.subject_id,
        request.predicate,
        request.object_type,
        request.object_id,
        project_id=request.project_id,
        metadata=request.metadata,
    )
    return _relation_out(row)


@router.get("/relations", response_model=list[RelationResponse])
async def list_relations(
    subject_type: str | None = None,
    subject_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    rows = wm.list_relations(current_user["user_id"], subject_type=subject_type, subject_id=subject_id)
    return [_relation_out(row) for row in rows]
