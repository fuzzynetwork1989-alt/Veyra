import os
import unittest
import uuid

from fastapi.testclient import TestClient

import main
from app.database import close_pool, init_pool
from app.migrate import run_migrations
from app.redis_client import close_redis, init_redis


@unittest.skipUnless(
    os.getenv("RUN_INTEGRATION_TESTS") == "1",
    "Set RUN_INTEGRATION_TESTS=1 to run live database integration tests",
)
class ChatIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ["MOCK_LLM"] = "1"
        from app.config import get_settings

        get_settings.cache_clear()
        database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://veyra:veyra_password_change_this@localhost:5432/veyra",
        )
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        init_pool(database_url)
        init_redis(redis_url)
        run_migrations(os.getenv("MIGRATIONS_DIR", "../../migrations"))
        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls):
        close_redis()
        close_pool()

    def _register_and_login(self) -> str:
        email = f"chat-{uuid.uuid4().hex[:8]}@example.com"
        password = "securepass123"
        response = self.client.post(
            "/auth/register",
            json={"email": email, "password": password},
        )
        self.assertEqual(response.status_code, 201)
        return response.json()["access_token"]

    def test_chat_persists_session_history(self):
        token = self._register_and_login()
        headers = {"Authorization": f"Bearer {token}"}

        first = self.client.post(
            "/chat/",
            headers=headers,
            json={"message": "Hello Veyra"},
        )
        self.assertEqual(first.status_code, 200)
        first_body = first.json()
        self.assertTrue(first_body["response"])
        self.assertEqual(first_body["model"], "veyra-mock")
        session_id = first_body["session_id"]

        second = self.client.post(
            "/chat/",
            headers=headers,
            json={"message": "What did I just say?", "session_id": session_id},
        )
        self.assertEqual(second.status_code, 200)

        history = self.client.get(
            f"/chat/history?session_id={session_id}",
            headers=headers,
        )
        self.assertEqual(history.status_code, 200)
        history_body = history.json()
        self.assertEqual(history_body["session_id"], session_id)
        self.assertGreaterEqual(len(history_body["messages"]), 4)
        roles = [message["role"] for message in history_body["messages"]]
        self.assertIn("user", roles)
        self.assertIn("assistant", roles)

    def test_chat_stream_returns_sse(self):
        token = self._register_and_login()
        headers = {"Authorization": f"Bearer {token}"}

        with self.client.stream(
            "POST",
            "/chat/stream",
            headers=headers,
            json={"message": "Stream hello"},
        ) as response:
            self.assertEqual(response.status_code, 200)
            body = "".join(response.iter_text())
            self.assertIn("event: token", body)
            self.assertIn("event: done", body)


if __name__ == "__main__":
    unittest.main()