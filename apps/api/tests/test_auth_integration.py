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
class AuthIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://veyra:veyra_password_change_this@localhost:5432/veyra",
        )
        init_pool(database_url)
        run_migrations(os.getenv("MIGRATIONS_DIR", "../../migrations"))
        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls):
        close_pool()

    def test_register_login_and_me_flow(self):
        email = f"integration-{uuid.uuid4().hex[:8]}@example.com"
        password = "securepass123"

        register_response = self.client.post(
            "/auth/register",
            json={"email": email, "password": password},
        )
        self.assertEqual(register_response.status_code, 201)
        register_body = register_response.json()
        self.assertEqual(register_body["email"], email)
        self.assertTrue(register_body["access_token"])

        login_response = self.client.post(
            "/auth/login",
            json={"email": email, "password": password},
        )
        self.assertEqual(login_response.status_code, 200)
        login_body = login_response.json()
        self.assertEqual(login_body["user_id"], register_body["user_id"])

        me_response = self.client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {login_body['access_token']}"},
        )
        self.assertEqual(me_response.status_code, 200)
        me_body = me_response.json()
        self.assertEqual(me_body["email"], email)
        self.assertEqual(me_body["user_id"], register_body["user_id"])


if __name__ == "__main__":
    unittest.main()