"""Node functions for the Veyra LangGraph runtime.

Each node is a pure-ish async function ``state -> partial_state``. Nodes call the
existing LLM layer (``app.llm``) so they transparently honour ``MOCK_LLM`` and
the local-LLM fallback, and they snapshot logical boundaries via the
checkpointer.
"""

import re
from typing import Any

from app import llm
from app.graph import checkpointer
from app.model_router import RouterDecision, log_decision, select_model

MAX_REPLANS = 2
MAX_STEP_RETRIES = 2
APPROVAL_THRESHOLD = 0.6


def _parse_steps(text: str) -> list[str]:
    steps: list[str] = []
    for line in text.splitlines():
        cleaned = re.sub(r"^\s*(?:\d+[.)]|[-*•])\s*", "", line).strip()
        if cleaned:
            steps.append(cleaned)
    return steps


def _fallback_plan(goal: str) -> list[str]:
    return [
        f"Clarify requirements and constraints for: {goal}",
        f"Produce the core solution for: {goal}",
        "Verify the result and summarize outcomes",
    ]


async def route_node(state: dict[str, Any]) -> dict[str, Any]:
    """Pick the model for this run via the intelligent router."""
    try:
        decision: RouterDecision = select_model("chat")
        log_decision(decision, user_id=state.get("user_id"), thread_id=state.get("thread_id"))
        model = decision.selected_model
        reason = decision.reason
    except Exception as exc:  # pragma: no cover - router fallback
        model = "veyra-default"
        reason = f"Router fallback: {exc}"
    return {"model": model, "log": [f"route: {reason}"]}


async def plan_node(state: dict[str, Any]) -> dict[str, Any]:
    goal = state["goal"]
    prompt = (
        f"Break the following objective into a short numbered list of concrete steps.\n\n"
        f"Objective: {goal}"
    )
    result = await llm.generate_chat_response(message=prompt, history=[], quality_mode="deep")
    steps = _parse_steps(result.get("response", ""))
    if len(steps) < 2:
        steps = _fallback_plan(goal)
    steps = steps[:8]

    update = {
        "plan": steps,
        "current_step": 0,
        "status": "planning",
        "log": [f"plan: {len(steps)} step(s)"],
    }
    checkpointer.save_checkpoint(state.get("thread_id", ""), "plan", 0, {**state, **update})
    return update


async def execute_node(state: dict[str, Any]) -> dict[str, Any]:
    plan = state.get("plan", [])
    index = state.get("current_step", 0)
    if index >= len(plan):
        return {}

    step = plan[index]
    history = [
        {"role": "assistant", "content": f"Step {i + 1}: {r.get('output', '')}"}
        for i, r in enumerate(state.get("step_results", []))
    ]
    prompt = f"Goal: {state['goal']}\nCurrent step ({index + 1}/{len(plan)}): {step}\nExecute this step."

    output = ""
    error: str | None = None
    for attempt in range(MAX_STEP_RETRIES + 1):
        try:
            result = await llm.generate_chat_response(message=prompt, history=history)
            output = result.get("response", "")
            error = None
            break
        except Exception as exc:  # pragma: no cover - transient LLM errors
            error = str(exc)
    return {
        "current_step": index + 1,
        "step_results": [{"step": step, "output": output, "error": error}],
        "status": "executing",
        "log": [f"execute[{index + 1}/{len(plan)}]: {'ok' if not error else 'retried/failed'}"],
    }


def _compose_draft(state: dict[str, Any]) -> str:
    parts = [f"- {r['step']}\n{r.get('output', '')}".strip() for r in state.get("step_results", [])]
    return "\n\n".join(parts).strip()


async def critic_node(state: dict[str, Any]) -> dict[str, Any]:
    draft = _compose_draft(state)
    plan = state.get("plan", [])
    completed = len(state.get("step_results", []))

    coverage = min(1.0, completed / max(1, len(plan)))
    score = coverage if draft else 0.0
    feedback = "Adequate coverage of the plan." if score >= APPROVAL_THRESHOLD else "Insufficient coverage; refine the plan."

    # Optional LLM judge sharpens the score when a real model is available.
    try:
        judge = await llm.generate_chat_response(
            message=(
                "Rate the following answer for the goal on a 0..1 scale. "
                "Reply with the number then a brief reason.\n\n"
                f"Goal: {state['goal']}\n\nAnswer:\n{draft}"
            ),
            history=[],
            quality_mode="fast",
        )
        match = re.search(r"(\d*\.?\d+)", judge.get("response", ""))
        if match:
            parsed = float(match.group(1))
            if parsed > 1:
                parsed = parsed / 10 if parsed <= 10 else 1.0
            score = round((score + parsed) / 2, 3)
            feedback = judge.get("response", feedback)[:500]
    except Exception:  # pragma: no cover - judge is optional
        pass

    approved = bool(draft) and score >= APPROVAL_THRESHOLD
    critique = {"approved": approved, "score": score, "feedback": feedback}
    update = {
        "draft": draft,
        "critique": critique,
        "status": "reviewing",
        "log": [f"critic: score={score} approved={approved}"],
    }
    checkpointer.save_checkpoint(state.get("thread_id", ""), "critic", completed, {**state, **update})
    return update


async def replan_node(state: dict[str, Any]) -> dict[str, Any]:
    feedback = state.get("critique", {}).get("feedback", "")
    plan = list(state.get("plan", []))
    plan.append(f"Address reviewer feedback and improve the result: {feedback[:200]}")
    return {
        "plan": plan,
        "replans": state.get("replans", 0) + 1,
        "status": "replanning",
        "log": [f"replan #{state.get('replans', 0) + 1}"],
    }


async def finalize_node(state: dict[str, Any]) -> dict[str, Any]:
    draft = state.get("draft") or _compose_draft(state)
    update = {
        "final": draft,
        "status": "completed",
        "log": ["finalize: run completed"],
    }
    checkpointer.save_checkpoint(state.get("thread_id", ""), "finalize", state.get("current_step", 0), {**state, **update})
    return update


# --- Conditional edge routers ---------------------------------------------

def after_execute(state: dict[str, Any]) -> str:
    if state.get("current_step", 0) < len(state.get("plan", [])):
        return "execute"
    return "critic"


def after_critic(state: dict[str, Any]) -> str:
    critique = state.get("critique", {})
    if critique.get("approved") or state.get("replans", 0) >= MAX_REPLANS:
        return "finalize"
    return "replan"
