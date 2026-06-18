import uuid

from app.database import execute, fetch_one


def ensure_default_project(user_id: str) -> None:
    existing = fetch_one(
        "SELECT id FROM projects WHERE user_id = %s LIMIT 1",
        (user_id,),
    )
    if not existing:
        create_default_project(user_id)


def create_default_project(user_id: str) -> dict:
    project_id = str(uuid.uuid4())
    execute(
        """
        INSERT INTO projects (id, user_id, name, description)
        VALUES (%s, %s, %s, %s)
        """,
        (project_id, user_id, "My Project", "Default workspace"),
    )
    return fetch_one(
        "SELECT id, name, description FROM projects WHERE id = %s",
        (project_id,),
    )