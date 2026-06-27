"""Assembly and execution of the Veyra LangGraph state machine."""

import uuid
from functools import lru_cache
from typing import Any

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from app.graph import checkpointer, nodes
from app.graph.state import VeyraState


@lru_cache(maxsize=1)
def build_graph():
    """Compile the Veyra graph.

    Topology:
        START -> route -> plan -> execute
        execute -> (more steps ? execute : critic)
        critic  -> (approved/exhausted ? finalize : replan)
        replan  -> execute
        finalize -> END
    """
    graph = StateGraph(VeyraState)

    graph.add_node("route", nodes.route_node)
    graph.add_node("plan", nodes.plan_node)
    graph.add_node("execute", nodes.execute_node)
    graph.add_node("critic", nodes.critic_node)
    graph.add_node("replan", nodes.replan_node)
    graph.add_node("finalize", nodes.finalize_node)

    graph.add_edge(START, "route")
    graph.add_edge("route", "plan")
    graph.add_edge("plan", "execute")
    graph.add_conditional_edges("execute", nodes.after_execute, {"execute": "execute", "critic": "critic"})
    graph.add_conditional_edges("critic", nodes.after_critic, {"replan": "replan", "finalize": "finalize"})
    graph.add_edge("replan", "execute")
    graph.add_edge("finalize", END)

    return graph.compile(checkpointer=MemorySaver())


async def run_graph(
    goal: str,
    *,
    user_id: str | None = None,
    project_id: str | None = None,
    thread_id: str | None = None,
    recursion_limit: int = 50,
) -> dict[str, Any]:
    """Execute the graph for ``goal`` and return the final state."""
    thread_id = thread_id or f"run-{uuid.uuid4().hex}"
    app = build_graph()

    initial: VeyraState = {
        "thread_id": thread_id,
        "user_id": user_id,
        "project_id": project_id,
        "goal": goal,
        "plan": [],
        "current_step": 0,
        "step_results": [],
        "retries": 0,
        "replans": 0,
        "status": "pending",
        "log": [],
    }

    checkpointer.start_run(thread_id, goal, user_id, project_id)
    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": recursion_limit}
    try:
        final_state = await app.ainvoke(initial, config=config)
    except Exception:
        checkpointer.finish_run(thread_id, "failed", {"goal": goal})
        raise

    final_state = dict(final_state)
    final_state["thread_id"] = thread_id
    checkpointer.finish_run(thread_id, final_state.get("status", "completed"), final_state)
    return final_state
