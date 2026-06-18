from fastapi import APIRouter, Depends, HTTPException, status

from app.database import fetch_all, fetch_one
from app.health import full_health
from app.routes.auth import get_current_user
from app.usage import get_user_usage_summary

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.get("/stats")
async def admin_stats(_: dict = Depends(require_admin)):
    users = fetch_one("SELECT COUNT(*) AS count FROM users WHERE deleted_at IS NULL")
    tasks_running = fetch_one(
        "SELECT COUNT(*) AS count FROM tasks WHERE status IN ('pending', 'running')"
    )
    tasks_total = fetch_one("SELECT COUNT(*) AS count FROM tasks")
    usage_24h = fetch_one(
        """
        SELECT COALESCE(SUM(tokens_used), 0) AS tokens, COUNT(*) AS events
        FROM usage_events
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '1 day'
        """
    )
    return {
        "users": int(users["count"]) if users else 0,
        "tasks_running": int(tasks_running["count"]) if tasks_running else 0,
        "tasks_total": int(tasks_total["count"]) if tasks_total else 0,
        "usage_24h": {
            "tokens": int(usage_24h["tokens"]) if usage_24h else 0,
            "events": int(usage_24h["events"]) if usage_24h else 0,
        },
        "health": full_health(),
    }


@router.get("/users")
async def admin_users(_: dict = Depends(require_admin)):
    rows = fetch_all(
        """
        SELECT u.id, u.email, u.role, u.created_at,
               COALESCE(SUM(ue.tokens_used), 0) AS tokens_24h
        FROM users u
        LEFT JOIN usage_events ue
          ON ue.user_id = u.id
         AND ue.created_at >= CURRENT_TIMESTAMP - INTERVAL '1 day'
        WHERE u.deleted_at IS NULL
        GROUP BY u.id, u.email, u.role, u.created_at
        ORDER BY u.created_at DESC
        LIMIT 100
        """
    )
    return [
        {
            "id": str(row["id"]),
            "email": row["email"],
            "role": row["role"],
            "created_at": row["created_at"].isoformat(),
            "tokens_24h": int(row["tokens_24h"]),
        }
        for row in rows
    ]


@router.get("/tasks")
async def admin_tasks(_: dict = Depends(require_admin)):
    rows = fetch_all(
        """
        SELECT t.id, t.description, t.status, t.priority, t.created_at, t.updated_at,
               u.email AS user_email
        FROM tasks t
        JOIN users u ON u.id = t.user_id
        ORDER BY t.created_at DESC
        LIMIT 100
        """
    )
    return [
        {
            "id": str(row["id"]),
            "description": row["description"],
            "status": row["status"],
            "priority": row["priority"],
            "user_email": row["user_email"],
            "created_at": row["created_at"].isoformat(),
            "updated_at": row["updated_at"].isoformat(),
        }
        for row in rows
    ]


@router.get("/usage/{user_id}")
async def admin_user_usage(user_id: str, _: dict = Depends(require_admin)):
    return get_user_usage_summary(user_id)