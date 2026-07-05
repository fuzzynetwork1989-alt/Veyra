"""Dreaming & self-update — background consolidation of user understanding."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from app import llm
from app.cognitive_memory import (
    complete_dream_cycle,
    get_or_create_profile,
    save_meso_summary,
    start_dream_cycle,
    update_profile,
)
from app.database import fetch_all


async def run_dream_cycle(user_id: str) -> dict[str, Any]:
    """Consolidate recent sessions into meso summary and macro profile updates."""
    cycle_id = start_dream_cycle(user_id)
    since = datetime.utcnow() - timedelta(days=7)

    sessions = fetch_all(
        """
        SELECT cs.id::text, cs.title, cs.updated_at
        FROM chat_sessions cs
        WHERE cs.user_id = %s AND cs.updated_at >= %s
        ORDER BY cs.updated_at DESC
        LIMIT 20
        """,
        (user_id, since),
    )

    if not sessions:
        complete_dream_cycle(
            cycle_id,
            sessions_processed=0,
            insights="No recent sessions to consolidate.",
            profile_delta="",
            status="completed",
        )
        return {"cycle_id": cycle_id, "sessions_processed": 0, "status": "completed"}

    session_titles = [f"- {s['title']}" for s in sessions[:10]]
    profile = get_or_create_profile(user_id)

    prompt = (
        "You are Veyra's dreaming consolidation process. Analyze recent user sessions and produce:\n"
        "1) A meso-time summary (recent themes, struggles, goals) — 3-5 sentences.\n"
        "2) A macro profile delta (long-term values, identity, communication preferences) — 2-4 sentences.\n"
        "3) Veyra self-notes (how to adjust style for this user) — 1-2 sentences.\n"
        "4) Theme tags as comma-separated list.\n\n"
        f"Current macro profile: {profile.get('macro_profile', 'empty')}\n\n"
        f"Recent sessions:\n" + "\n".join(session_titles)
    )

    try:
        result = await llm.generate_chat_response(message=prompt, history=[], quality_mode="deep", max_tokens=800)
        text = result.get("response", "")
    except Exception as exc:
        complete_dream_cycle(
            cycle_id,
            sessions_processed=len(sessions),
            insights=str(exc),
            profile_delta="",
            status="failed",
        )
        return {"cycle_id": cycle_id, "sessions_processed": len(sessions), "status": "failed", "error": str(exc)}

    themes: list[str] = []
    for line in text.splitlines():
        if line.lower().startswith("theme") or "tags:" in line.lower():
            raw = line.split(":", 1)[-1]
            themes = [t.strip() for t in raw.split(",") if t.strip()]

    save_meso_summary(user_id, summary=text[:2000], themes=themes)
    update_profile(
        user_id,
        macro_profile=(profile.get("macro_profile", "") + "\n" + text[:500]).strip()[:4000],
        self_notes=text[-300:].strip()[:1500],
    )

    complete_dream_cycle(
        cycle_id,
        sessions_processed=len(sessions),
        insights=text[:1500],
        profile_delta=text[:500],
        status="completed",
    )

    return {
        "cycle_id": cycle_id,
        "sessions_processed": len(sessions),
        "status": "completed",
        "insights_preview": text[:300],
    }