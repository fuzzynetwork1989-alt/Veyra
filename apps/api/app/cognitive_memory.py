"""Persistence for Cognitive OS temporal memory and trace events."""

from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any

from app.database import execute, fetch_all, fetch_one


def get_or_create_profile(user_id: str) -> dict[str, Any]:
    row = fetch_one(
        "SELECT * FROM cognitive_profiles WHERE user_id = %s",
        (user_id,),
    )
    if row:
        return row
    execute(
        """
        INSERT INTO cognitive_profiles (user_id, macro_profile, self_notes)
        VALUES (%s, '', '')
        ON CONFLICT (user_id) DO NOTHING
        """,
        (user_id,),
    )
    return fetch_one("SELECT * FROM cognitive_profiles WHERE user_id = %s", (user_id,)) or {
        "macro_profile": "",
        "self_notes": "",
        "preferences": {},
    }


def update_profile(
    user_id: str,
    *,
    macro_profile: str | None = None,
    self_notes: str | None = None,
    preferences: dict[str, Any] | None = None,
) -> dict[str, Any]:
    get_or_create_profile(user_id)
    execute(
        """
        UPDATE cognitive_profiles
        SET macro_profile = COALESCE(%s, macro_profile),
            self_notes = COALESCE(%s, self_notes),
            preferences = COALESCE(%s::jsonb, preferences),
            updated_at = NOW()
        WHERE user_id = %s
        """,
        (
            macro_profile,
            self_notes,
            json.dumps(preferences) if preferences is not None else None,
            user_id,
        ),
    )
    return get_or_create_profile(user_id)


def get_latest_meso_summary(user_id: str) -> dict[str, Any] | None:
    return fetch_one(
        """
        SELECT * FROM cognitive_meso_summaries
        WHERE user_id = %s
        ORDER BY period_end DESC
        LIMIT 1
        """,
        (user_id,),
    )


def save_meso_summary(
    user_id: str,
    *,
    summary: str,
    themes: list[str] | None = None,
    days: int = 7,
) -> None:
    end = date.today()
    start = end - timedelta(days=days)
    execute(
        """
        INSERT INTO cognitive_meso_summaries (user_id, period_start, period_end, summary, themes)
        VALUES (%s, %s, %s, %s, %s::jsonb)
        """,
        (user_id, start, end, summary, json.dumps(themes or [])),
    )


def record_trace_event(
    user_id: str,
    *,
    session_id: str | None,
    phase: str,
    label: str,
    detail: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    execute(
        """
        INSERT INTO cognitive_trace_events (user_id, session_id, phase, label, detail, metadata)
        VALUES (%s, %s, %s, %s, %s, %s::jsonb)
        """,
        (user_id, session_id, phase, label, detail, json.dumps(metadata or {})),
    )


def list_trace_events(user_id: str, session_id: str, limit: int = 50) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT phase, label, detail, metadata, created_at
        FROM cognitive_trace_events
        WHERE user_id = %s AND session_id = %s
        ORDER BY created_at ASC
        LIMIT %s
        """,
        (user_id, session_id, limit),
    )


def start_dream_cycle(user_id: str) -> str:
    row = fetch_one(
        """
        INSERT INTO cognitive_dream_cycles (user_id, status)
        VALUES (%s, 'running')
        RETURNING id::text
        """,
        (user_id,),
    )
    return row["id"] if row else ""


def complete_dream_cycle(
    cycle_id: str,
    *,
    sessions_processed: int,
    insights: str,
    profile_delta: str,
    status: str = "completed",
) -> None:
    execute(
        """
        UPDATE cognitive_dream_cycles
        SET status = %s, sessions_processed = %s, insights = %s,
            profile_delta = %s, completed_at = NOW()
        WHERE id = %s
        """,
        (status, sessions_processed, insights, profile_delta, cycle_id),
    )


def list_dream_cycles(user_id: str, limit: int = 10) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT id::text, status, sessions_processed, insights, profile_delta,
               started_at, completed_at
        FROM cognitive_dream_cycles
        WHERE user_id = %s
        ORDER BY started_at DESC
        LIMIT %s
        """,
        (user_id, limit),
    )


def get_cognitive_state(user_id: str) -> dict[str, Any]:
    profile = get_or_create_profile(user_id)
    meso = get_latest_meso_summary(user_id)
    dreams = list_dream_cycles(user_id, limit=3)
    return {
        "profile": {
            "macro_profile": profile.get("macro_profile", ""),
            "self_notes": profile.get("self_notes", ""),
            "preferences": profile.get("preferences") or {},
            "updated_at": profile.get("updated_at"),
        },
        "meso": {
            "summary": meso.get("summary") if meso else "",
            "themes": meso.get("themes") if meso else [],
            "period_end": meso.get("period_end") if meso else None,
        },
        "recent_dreams": dreams,
    }