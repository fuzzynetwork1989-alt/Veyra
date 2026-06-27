"""World-model persistence services.

CRUD helpers for the durable entities introduced in migration 007: organizations,
agents, artifacts, tools, and the generic relation graph. All access is scoped to
the owning user so project-level data stays isolated.
"""

import json
import re
import uuid
from typing import Any

from app.database import execute, fetch_all, fetch_one

ENTITY_TYPES = {"organization", "project", "agent", "artifact", "tool", "task", "user"}


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "org"


def _dump(value: Any) -> str | None:
    return json.dumps(value) if value is not None else None


# --- Organizations ---------------------------------------------------------

def create_organization(user_id: str, name: str, description: str | None = None) -> dict[str, Any]:
    org_id = str(uuid.uuid4())
    slug = f"{_slugify(name)}-{org_id[:8]}"
    execute(
        """
        INSERT INTO organizations (id, owner_id, name, slug, description)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (org_id, user_id, name, slug, description),
    )
    execute(
        """
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (%s, %s, 'owner')
        """,
        (org_id, user_id),
    )
    return get_organization(org_id, user_id)


def get_organization(org_id: str, user_id: str) -> dict[str, Any] | None:
    return fetch_one(
        """
        SELECT o.id, o.name, o.slug, o.description, o.created_at
        FROM organizations o
        JOIN organization_members m ON m.organization_id = o.id
        WHERE o.id = %s AND m.user_id = %s
        """,
        (org_id, user_id),
    )


def list_organizations(user_id: str) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT o.id, o.name, o.slug, o.description, o.created_at
        FROM organizations o
        JOIN organization_members m ON m.organization_id = o.id
        WHERE m.user_id = %s
        ORDER BY o.created_at ASC
        """,
        (user_id,),
    )


# --- Agents ----------------------------------------------------------------

def create_agent(
    user_id: str,
    name: str,
    *,
    role: str = "generalist",
    project_id: str | None = None,
    system_prompt: str | None = None,
    model_preference: str | None = None,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    agent_id = str(uuid.uuid4())
    execute(
        """
        INSERT INTO agents (id, user_id, project_id, name, role, system_prompt, model_preference, config)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (agent_id, user_id, project_id, name, role, system_prompt, model_preference, _dump(config)),
    )
    return get_agent(agent_id, user_id)


def get_agent(agent_id: str, user_id: str) -> dict[str, Any] | None:
    return fetch_one(
        """
        SELECT id, project_id, name, role, system_prompt, model_preference, config, status, created_at
        FROM agents
        WHERE id = %s AND user_id = %s
        """,
        (agent_id, user_id),
    )


def list_agents(user_id: str, project_id: str | None = None) -> list[dict[str, Any]]:
    if project_id:
        return fetch_all(
            """
            SELECT id, project_id, name, role, system_prompt, model_preference, config, status, created_at
            FROM agents WHERE user_id = %s AND project_id = %s ORDER BY created_at ASC
            """,
            (user_id, project_id),
        )
    return fetch_all(
        """
        SELECT id, project_id, name, role, system_prompt, model_preference, config, status, created_at
        FROM agents WHERE user_id = %s ORDER BY created_at ASC
        """,
        (user_id,),
    )


# --- Artifacts -------------------------------------------------------------

def create_artifact(
    user_id: str,
    name: str,
    *,
    artifact_type: str = "text",
    content: str | None = None,
    project_id: str | None = None,
    task_id: str | None = None,
    agent_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    artifact_id = str(uuid.uuid4())
    execute(
        """
        INSERT INTO artifacts (id, user_id, project_id, task_id, agent_id, artifact_type, name, content, metadata)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (artifact_id, user_id, project_id, task_id, agent_id, artifact_type, name, content, _dump(metadata)),
    )
    return get_artifact(artifact_id, user_id)


def get_artifact(artifact_id: str, user_id: str) -> dict[str, Any] | None:
    return fetch_one(
        """
        SELECT id, project_id, task_id, agent_id, artifact_type, name, content, metadata, created_at
        FROM artifacts WHERE id = %s AND user_id = %s
        """,
        (artifact_id, user_id),
    )


def list_artifacts(user_id: str, project_id: str | None = None) -> list[dict[str, Any]]:
    if project_id:
        return fetch_all(
            """
            SELECT id, project_id, task_id, agent_id, artifact_type, name, metadata, created_at
            FROM artifacts WHERE user_id = %s AND project_id = %s ORDER BY created_at DESC
            """,
            (user_id, project_id),
        )
    return fetch_all(
        """
        SELECT id, project_id, task_id, agent_id, artifact_type, name, metadata, created_at
        FROM artifacts WHERE user_id = %s ORDER BY created_at DESC
        """,
        (user_id,),
    )


# --- Tools -----------------------------------------------------------------

def create_tool(
    user_id: str,
    name: str,
    *,
    description: str | None = None,
    input_schema: dict[str, Any] | None = None,
    project_id: str | None = None,
    enabled: bool = True,
) -> dict[str, Any]:
    tool_id = str(uuid.uuid4())
    execute(
        """
        INSERT INTO tools (id, user_id, project_id, name, description, input_schema, enabled)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (tool_id, user_id, project_id, name, description, _dump(input_schema), enabled),
    )
    return fetch_one(
        "SELECT id, project_id, name, description, input_schema, enabled, created_at FROM tools WHERE id = %s",
        (tool_id,),
    )


def list_tools(user_id: str, project_id: str | None = None) -> list[dict[str, Any]]:
    if project_id:
        return fetch_all(
            """
            SELECT id, project_id, name, description, input_schema, enabled, created_at
            FROM tools WHERE user_id = %s AND project_id = %s ORDER BY created_at ASC
            """,
            (user_id, project_id),
        )
    return fetch_all(
        """
        SELECT id, project_id, name, description, input_schema, enabled, created_at
        FROM tools WHERE user_id = %s ORDER BY created_at ASC
        """,
        (user_id,),
    )


# --- Relations -------------------------------------------------------------

def create_relation(
    user_id: str,
    subject_type: str,
    subject_id: str,
    predicate: str,
    object_type: str,
    object_id: str,
    *,
    project_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    relation_id = str(uuid.uuid4())
    execute(
        """
        INSERT INTO relations
            (id, user_id, project_id, subject_type, subject_id, predicate, object_type, object_id, metadata)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (subject_type, subject_id, predicate, object_type, object_id) DO NOTHING
        """,
        (relation_id, user_id, project_id, subject_type, subject_id, predicate, object_type, object_id, _dump(metadata)),
    )
    return fetch_one(
        """
        SELECT id, subject_type, subject_id, predicate, object_type, object_id, metadata, created_at
        FROM relations
        WHERE subject_type = %s AND subject_id = %s AND predicate = %s AND object_type = %s AND object_id = %s
        """,
        (subject_type, subject_id, predicate, object_type, object_id),
    )


def list_relations(
    user_id: str,
    *,
    subject_type: str | None = None,
    subject_id: str | None = None,
) -> list[dict[str, Any]]:
    clauses = ["user_id = %s"]
    params: list[Any] = [user_id]
    if subject_type:
        clauses.append("subject_type = %s")
        params.append(subject_type)
    if subject_id:
        clauses.append("subject_id = %s")
        params.append(subject_id)
    where = " AND ".join(clauses)
    return fetch_all(
        f"""
        SELECT id, subject_type, subject_id, predicate, object_type, object_id, metadata, created_at
        FROM relations WHERE {where} ORDER BY created_at ASC
        """,
        tuple(params),
    )
