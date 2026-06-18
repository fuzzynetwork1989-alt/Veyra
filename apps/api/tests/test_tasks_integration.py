import json
import os
import shutil
import subprocess
import sys
import time
import unittest
import uuid

from fastapi.testclient import TestClient

import main
from app.database import close_pool, fetch_one, init_pool
from app.migrate import run_migrations
from app.redis_client import close_redis, get_redis, init_redis


def _worker_env() -> dict[str, str]:
    env = os.environ.copy()
    env["MOCK_LLM"] = "1"
    env.setdefault(
        "DATABASE_URL",
        os.getenv("DATABASE_URL", "postgresql://veyra:veyra_password_change_this@localhost:5432/veyra"),
    )
    node_dirs = [
        r"C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs",
        r"C:\Program Files\nodejs",
    ]
    for node_dir in node_dirs:
        npx = os.path.join(node_dir, "npx.cmd" if sys.platform.startswith("win") else "npx")
        if os.path.exists(npx):
            env["PATH"] = f"{node_dir}{os.pathsep}{env.get('PATH', '')}"
            break
    return env


def _run_worker_once(payload: dict) -> subprocess.CompletedProcess[str]:
    worker_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../worker"))
    env = _worker_env()
    npx = shutil.which("npx", path=env.get("PATH")) or "npx"
    cmd = [npx, "tsx", "scripts/process-one.ts", json.dumps(payload)]
    return subprocess.run(
        cmd,
        cwd=worker_root,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
        shell=sys.platform.startswith("win"),
    )


@unittest.skipUnless(
    os.getenv("RUN_INTEGRATION_TESTS") == "1",
    "Set RUN_INTEGRATION_TESTS=1 to run live database integration tests",
)
class TaskIntegrationTests(unittest.TestCase):
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

    def _register(self) -> str:
        email = f"task-{uuid.uuid4().hex[:8]}@example.com"
        response = self.client.post(
            "/auth/register",
            json={"email": email, "password": "securepass123"},
        )
        self.assertEqual(response.status_code, 201)
        return response.json()["access_token"]

    def test_task_pipeline_completes_with_mock_worker(self):
        token = self._register()
        headers = {"Authorization": f"Bearer {token}"}

        description = "Understand and summarize project setup"
        create = self.client.post(
            "/tasks/execute",
            headers=headers,
            json={"description": description},
        )
        self.assertEqual(create.status_code, 202)
        body = create.json()
        task_id = body["task_id"]

        redis = get_redis()
        queued = redis.brpop("veyra:tasks:queue", timeout=2)
        if queued:
            payload = json.loads(queued[1])
            result = _run_worker_once(payload)
            self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        else:
            row = fetch_one(
                "SELECT status, user_id, project_id, priority FROM tasks WHERE id = %s",
                (task_id,),
            )
            self.assertIsNotNone(row)
            if row["status"] in {"pending", "running"}:
                if row["status"] == "pending":
                    payload = {
                        "id": task_id,
                        "userId": row["user_id"],
                        "projectId": row["project_id"],
                        "description": description,
                        "context": {},
                        "priority": row["priority"],
                    }
                    result = _run_worker_once(payload)
                    self.assertEqual(result.returncode, 0, result.stderr or result.stdout)

        deadline = time.time() + 30
        while time.time() < deadline:
            row = fetch_one("SELECT status FROM tasks WHERE id = %s", (task_id,))
            if row and row["status"] == "completed":
                break
            time.sleep(0.5)

        response = self.client.get(f"/tasks/{task_id}", headers=headers)
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "completed")
        self.assertIsNotNone(body.get("result"))


if __name__ == "__main__":
    unittest.main()