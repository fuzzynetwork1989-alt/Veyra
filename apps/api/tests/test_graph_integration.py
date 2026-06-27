import os
import unittest
import uuid

from fastapi.testclient import TestClient

import main
from app.database import close_pool, init_pool
from app.migrate import run_migrations


@unittest.skipUnless(
    os.getenv("RUN_INTEGRATION_TESTS") == "1",
    "Set RUN_INTEGRATION_TESTS=1 to run live database integration tests",
)
class GraphIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ["MOCK_LLM"] = "1"
        from app.config import get_settings

        get_settings.cache_clear()
        database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://veyra:veyra_password_change_this@localhost:5432/veyra",
        )
        init_pool(database_url)
        run_migrations(os.getenv("MIGRATIONS_DIR", "../../migrations"))
        cls.client = TestClient(main.app)
        email = f"graph-{uuid.uuid4().hex[:8]}@example.com"
        res = cls.client.post("/auth/register", json={"email": email, "password": "securepass123"})
        assert res.status_code == 201, res.text
        cls.headers = {"Authorization": f"Bearer {res.json()['access_token']}"}

    @classmethod
    def tearDownClass(cls):
        close_pool()

    def test_run_graph_and_replay_checkpoints(self):
        run = self.client.post(
            "/graph/run", headers=self.headers, json={"goal": "Implement vector search"}
        )
        self.assertEqual(run.status_code, 200, run.text)
        body = run.json()
        self.assertEqual(body["status"], "completed")
        self.assertTrue(body["plan"])
        self.assertTrue(body["final"])
        thread_id = body["thread_id"]

        replay = self.client.get(f"/graph/runs/{thread_id}/checkpoints", headers=self.headers)
        self.assertEqual(replay.status_code, 200, replay.text)
        nodes = {c["node"] for c in replay.json()["checkpoints"]}
        self.assertIn("plan", nodes)
        self.assertIn("finalize", nodes)

    def test_router_select_endpoint(self):
        res = self.client.get("/router/select", headers=self.headers, params={"purpose": "chat"})
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json()["purpose"], "chat")


if __name__ == "__main__":
    unittest.main()
