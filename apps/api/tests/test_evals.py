import asyncio
import os
import unittest

os.environ["MOCK_LLM"] = "1"

from app.config import get_settings  # noqa: E402
from evals.scorer import keyword_coverage, score_case  # noqa: E402


class ScorerTests(unittest.TestCase):
    def test_keyword_coverage(self):
        self.assertEqual(keyword_coverage("the api handles todo items", ["api", "todo"]), 1.0)
        self.assertEqual(keyword_coverage("the api only", ["api", "todo"]), 0.5)
        self.assertEqual(keyword_coverage("nothing", []), 1.0)

    def test_score_case_pass_fail(self):
        passed = score_case("c1", "api todo done", ["api", "todo"], 1.0, min_score=0.5)
        self.assertTrue(passed.passed)
        failed = score_case("c2", "unrelated", ["api", "todo"], 0.0, min_score=0.5)
        self.assertFalse(failed.passed)


class BenchmarkRunnerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        get_settings.cache_clear()
        get_settings()

    def test_chat_benchmark_runs(self):
        from evals.runner import run_benchmark

        scores = asyncio.run(run_benchmark("evals/dataset.jsonl", "chat"))
        self.assertEqual(len(scores), 5)
        # Mock chat echoes the goal, so goal-derived keywords are covered.
        self.assertTrue(all(s.keyword_coverage > 0 for s in scores))


if __name__ == "__main__":
    unittest.main()
