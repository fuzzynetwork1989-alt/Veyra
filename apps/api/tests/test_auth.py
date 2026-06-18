import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import main
from app.routes.auth import create_access_token, hash_password


class AuthRouteTests(unittest.TestCase):
    def setUp(self):
        self.patchers = [
            patch("main.init_pool"),
            patch("main.run_migrations"),
        ]
        for patcher in self.patchers:
            patcher.start()
        self.client = TestClient(main.app)

    def tearDown(self):
        for patcher in self.patchers:
            patcher.stop()

    @patch("app.routes.auth.issue_refresh_token", return_value="refresh-token-test")
    @patch("app.routes.auth.create_default_project")
    @patch("app.routes.auth.fetch_one")
    def test_register_creates_user(
        self, mock_fetch_one, mock_create_default_project, _mock_refresh
    ):
        mock_fetch_one.side_effect = [
            None,
            {
                "id": "11111111-1111-1111-1111-111111111111",
                "email": "dev@example.com",
                "role": "user",
            },
        ]

        response = self.client.post(
            "/auth/register",
            json={"email": "dev@example.com", "password": "securepass"},
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["email"], "dev@example.com")
        self.assertEqual(body["role"], "user")
        self.assertTrue(body["access_token"])

    @patch("app.routes.auth.fetch_one")
    def test_register_rejects_duplicate_email(self, mock_fetch_one):
        mock_fetch_one.return_value = {
            "id": "11111111-1111-1111-1111-111111111111",
            "email": "dev@example.com",
            "password_hash": hash_password("securepass"),
            "role": "user",
        }

        response = self.client.post(
            "/auth/register",
            json={"email": "dev@example.com", "password": "securepass"},
        )

        self.assertEqual(response.status_code, 409)

    @patch("app.routes.auth.issue_refresh_token", return_value="refresh-token-test")
    @patch("app.routes.auth.fetch_one")
    def test_login_returns_token_for_valid_credentials(self, mock_fetch_one, _mock_refresh):
        mock_fetch_one.return_value = {
            "id": "11111111-1111-1111-1111-111111111111",
            "email": "dev@example.com",
            "password_hash": hash_password("securepass"),
            "role": "user",
        }

        response = self.client.post(
            "/auth/login",
            json={"email": "dev@example.com", "password": "securepass"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["access_token"])

    @patch("app.routes.auth.fetch_one")
    def test_login_rejects_invalid_password(self, mock_fetch_one):
        mock_fetch_one.return_value = {
            "id": "11111111-1111-1111-1111-111111111111",
            "email": "dev@example.com",
            "password_hash": hash_password("securepass"),
            "role": "user",
        }

        response = self.client.post(
            "/auth/login",
            json={"email": "dev@example.com", "password": "wrong-password"},
        )

        self.assertEqual(response.status_code, 401)

    @patch("app.routes.auth.fetch_one")
    def test_me_returns_current_user(self, mock_fetch_one):
        user_id = "11111111-1111-1111-1111-111111111111"
        token = create_access_token(
            {
                "sub": "me@example.com",
                "user_id": user_id,
                "role": "user",
            }
        )
        mock_fetch_one.return_value = {
            "id": user_id,
            "email": "me@example.com",
            "role": "user",
        }

        response = self.client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "me@example.com")
        self.assertEqual(response.json()["user_id"], user_id)


if __name__ == "__main__":
    unittest.main()