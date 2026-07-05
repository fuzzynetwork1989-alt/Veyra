import unittest
from unittest.mock import AsyncMock, patch

from app.cognitive.faculties import select_faculties
from app.cognitive.modes import get_mode
from app.cognitive.prompts import INNER_SELVES, VEYRA_META_BRAIN


class CognitiveModesTests(unittest.TestCase):
    def test_inner_voice_has_all_selves(self):
        mode = get_mode("inner_voice")
        self.assertIn("strategist", mode["selves"])
        self.assertIn("empath", mode["selves"])
        self.assertEqual(len(mode["selves"]), 5)

    def test_planner_weights_strategist_higher(self):
        mode = get_mode("planner")
        self.assertGreater(mode["weights"]["strategist"], mode["weights"]["empath"])


class CognitiveFacultiesTests(unittest.TestCase):
    def test_code_faculty_for_code_message(self):
        faculties = select_faculties("Fix this TypeScript bug in my API")
        ids = [f["id"] for f in faculties]
        self.assertIn("code_cortex", ids)

    def test_default_language_center(self):
        faculties = select_faculties("Hello")
        ids = [f["id"] for f in faculties]
        self.assertIn("language_center", ids)


class CognitivePromptsTests(unittest.TestCase):
    def test_meta_brain_contains_selves(self):
        self.assertIn("Strategist", VEYRA_META_BRAIN)
        self.assertIn("VEYRA_META_BRAIN", VEYRA_META_BRAIN)

    def test_inner_selves_complete(self):
        expected = {"strategist", "empath", "archivist", "challenger", "creator"}
        self.assertEqual(set(INNER_SELVES.keys()), expected)


class CognitiveKernelTests(unittest.IsolatedAsyncioTestCase):
    @patch("app.cognitive.kernel.run_ethics_gate", new_callable=AsyncMock)
    @patch("app.cognitive.kernel.run_inner_chorus", new_callable=AsyncMock)
    @patch("app.cognitive.kernel.load_temporal_layers")
    @patch("app.cognitive.kernel.llm.generate_chat_response", new_callable=AsyncMock)
    async def test_process_returns_cognitive_result(
        self, mock_llm, mock_temporal, mock_chorus, mock_ethics
    ):
        from app.cognitive.kernel import CognitiveKernel

        mock_temporal.return_value = {"micro": "now", "meso": "recent", "macro": "life"}
        mock_ethics.return_value = {
            "emotional_state": "curious",
            "needs": ["clarity"],
            "risk_flags": [],
            "desired_tone": "warm",
            "safety_level": "low",
        }
        mock_chorus.return_value = (
            [{"role": "strategist", "voice": "Plan first", "weight": 1.0}],
            10,
        )
        mock_llm.return_value = {"response": "Integrated answer", "model": "test", "tokens_used": 50}

        kernel = CognitiveKernel()
        result = await kernel.process(
            user_id="user-1",
            session_id="sess-1",
            message="Help me plan",
            history=[],
            cognitive_mode="inner_voice",
        )

        self.assertEqual(result.response, "Integrated answer")
        self.assertGreater(len(result.thinking_steps), 3)
        self.assertEqual(result.mode, "inner_voice")


if __name__ == "__main__":
    unittest.main()