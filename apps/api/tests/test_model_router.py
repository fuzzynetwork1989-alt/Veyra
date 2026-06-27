import unittest

from app.model_router import select_model


class ModelRouterTests(unittest.TestCase):
    def setUp(self):
        self.models = [
            "qwen2.5-coder-32b-instruct",
            "llama-3.1-8b-instruct",
            "deepseek-r1-distill-qwen-14b",
            "nomic-embed-text-v1.5",
        ]

    def test_chat_prefers_instruct_model(self):
        decision = select_model("chat", available_models=self.models)
        self.assertIn("instruct", decision.selected_model)
        self.assertEqual(decision.purpose, "chat")

    def test_code_prefers_coder_model(self):
        decision = select_model("code", available_models=self.models)
        self.assertEqual(decision.selected_model, "qwen2.5-coder-32b-instruct")

    def test_embedding_only_picks_embedding_model(self):
        decision = select_model("embedding", available_models=self.models)
        self.assertEqual(decision.selected_model, "nomic-embed-text-v1.5")

    def test_reasoning_prefers_reasoning_model(self):
        decision = select_model("reasoning", available_models=self.models)
        self.assertEqual(decision.selected_model, "deepseek-r1-distill-qwen-14b")

    def test_preferred_model_wins_when_available(self):
        decision = select_model(
            "chat", preferred_model="llama-3.1-8b-instruct", available_models=self.models
        )
        self.assertEqual(decision.selected_model, "llama-3.1-8b-instruct")
        self.assertIn("preferred", decision.reason)

    def test_no_embedding_model_raises(self):
        with self.assertRaises(RuntimeError):
            select_model("embedding", available_models=["llama-3.1-8b-instruct"])

    def test_unknown_purpose_falls_back_to_chat(self):
        decision = select_model("nonsense", available_models=self.models)
        self.assertEqual(decision.purpose, "chat")


if __name__ == "__main__":
    unittest.main()
