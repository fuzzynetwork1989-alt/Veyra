import asyncio
import os
import unittest

os.environ["MOCK_LLM"] = "1"

from app.config import get_settings  # noqa: E402


class GraphRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        get_settings.cache_clear()
        get_settings()

    def test_run_graph_completes_with_plan_and_final(self):
        from app.graph.builder import run_graph

        state = asyncio.run(run_graph("Build a small CLI tool", thread_id="test-thread-1"))

        self.assertEqual(state["status"], "completed")
        self.assertTrue(state["plan"], "expected a non-empty plan")
        self.assertTrue(state["final"], "expected a final answer")
        self.assertIn("critique", state)
        self.assertEqual(state["thread_id"], "test-thread-1")
        # Every plan step should have produced a step result.
        self.assertGreaterEqual(len(state["step_results"]), len(state["plan"]) - state.get("replans", 0))

    def test_conditional_edges_module(self):
        from app.graph import nodes

        self.assertEqual(nodes.after_execute({"current_step": 1, "plan": ["a", "b"]}), "execute")
        self.assertEqual(nodes.after_execute({"current_step": 2, "plan": ["a", "b"]}), "critic")
        self.assertEqual(
            nodes.after_critic({"critique": {"approved": True}, "replans": 0}), "finalize"
        )
        self.assertEqual(
            nodes.after_critic({"critique": {"approved": False}, "replans": 0}), "replan"
        )
        self.assertEqual(
            nodes.after_critic({"critique": {"approved": False}, "replans": 99}), "finalize"
        )


if __name__ == "__main__":
    unittest.main()
