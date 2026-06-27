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
class WorldModelIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://veyra:veyra_password_change_this@localhost:5432/veyra",
        )
        init_pool(database_url)
        run_migrations(os.getenv("MIGRATIONS_DIR", "../../migrations"))
        cls.client = TestClient(main.app)
        cls.headers = cls._auth_headers()

    @classmethod
    def tearDownClass(cls):
        close_pool()

    @classmethod
    def _auth_headers(cls) -> dict[str, str]:
        email = f"world-{uuid.uuid4().hex[:8]}@example.com"
        res = cls.client.post("/auth/register", json={"email": email, "password": "securepass123"})
        assert res.status_code == 201, res.text
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def _project_id(self) -> str:
        res = self.client.get("/projects/", headers=self.headers)
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()[0]["id"]

    def test_organization_crud(self):
        res = self.client.post("/world/organizations", headers=self.headers, json={"name": "Acme"})
        self.assertEqual(res.status_code, 201, res.text)
        body = res.json()
        self.assertEqual(body["name"], "Acme")
        self.assertTrue(body["slug"])

        listing = self.client.get("/world/organizations", headers=self.headers)
        self.assertEqual(listing.status_code, 200)
        self.assertTrue(any(o["id"] == body["id"] for o in listing.json()))

    def test_agent_artifact_tool_relation_flow(self):
        project_id = self._project_id()

        agent = self.client.post(
            "/world/agents",
            headers=self.headers,
            json={"name": "Planner", "role": "planner", "project_id": project_id, "config": {"temp": 0.2}},
        )
        self.assertEqual(agent.status_code, 201, agent.text)
        agent_id = agent.json()["id"]
        self.assertEqual(agent.json()["config"], {"temp": 0.2})

        artifact = self.client.post(
            "/world/artifacts",
            headers=self.headers,
            json={"name": "Plan v1", "artifact_type": "plan", "content": "step 1", "project_id": project_id, "agent_id": agent_id},
        )
        self.assertEqual(artifact.status_code, 201, artifact.text)
        artifact_id = artifact.json()["id"]

        tool = self.client.post(
            "/world/tools",
            headers=self.headers,
            json={"name": "search", "description": "web search", "project_id": project_id, "input_schema": {"q": "str"}},
        )
        self.assertEqual(tool.status_code, 201, tool.text)

        relation = self.client.post(
            "/world/relations",
            headers=self.headers,
            json={
                "subject_type": "agent",
                "subject_id": agent_id,
                "predicate": "produced",
                "object_type": "artifact",
                "object_id": artifact_id,
                "project_id": project_id,
            },
        )
        self.assertEqual(relation.status_code, 201, relation.text)

        relations = self.client.get(
            "/world/relations", headers=self.headers, params={"subject_id": agent_id}
        )
        self.assertEqual(relations.status_code, 200)
        self.assertTrue(any(r["object_id"] == artifact_id for r in relations.json()))

    def test_project_scoping_rejects_foreign_project(self):
        res = self.client.post(
            "/world/agents",
            headers=self.headers,
            json={"name": "X", "project_id": str(uuid.uuid4())},
        )
        self.assertEqual(res.status_code, 404, res.text)


if __name__ == "__main__":
    unittest.main()
