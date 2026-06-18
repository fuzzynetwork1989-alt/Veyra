import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.database import execute, fetch_all, fetch_one
from app.projects_service import ensure_default_project
from app.routes.auth import get_current_user

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str | None = None


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(current_user: dict = Depends(get_current_user)):
    ensure_default_project(current_user["user_id"])
    rows = fetch_all(
        """
        SELECT id, name, description
        FROM projects
        WHERE user_id = %s
        ORDER BY created_at ASC
        """,
        (current_user["user_id"],),
    )
    return [
        ProjectResponse(
            id=str(row["id"]),
            name=row["name"],
            description=row.get("description"),
        )
        for row in rows
    ]


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    request: ProjectCreate,
    current_user: dict = Depends(get_current_user),
):
    project_id = str(uuid.uuid4())
    execute(
        """
        INSERT INTO projects (id, user_id, name, description)
        VALUES (%s, %s, %s, %s)
        """,
        (project_id, current_user["user_id"], request.name, request.description),
    )
    row = fetch_one(
        "SELECT id, name, description FROM projects WHERE id = %s",
        (project_id,),
    )
    return ProjectResponse(
        id=str(row["id"]),
        name=row["name"],
        description=row.get("description"),
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    row = fetch_one(
        """
        SELECT id, name, description
        FROM projects
        WHERE id = %s AND user_id = %s
        """,
        (project_id, current_user["user_id"]),
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return ProjectResponse(
        id=str(row["id"]),
        name=row["name"],
        description=row.get("description"),
    )