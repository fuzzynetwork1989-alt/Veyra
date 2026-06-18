import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.usage import check_usage_quota


class UsageQuotaTests(unittest.TestCase):
    @patch("app.usage.get_effective_quotas")
    @patch("app.usage._daily_usage")
    def test_blocks_when_token_quota_exceeded(self, mock_daily_usage, mock_quotas):
        mock_quotas.return_value = {"tokens": 100, "chats": 10, "tasks": 10}
        mock_daily_usage.return_value = {"tokens": 100, "chats": 0, "tasks": 0}

        with self.assertRaises(HTTPException) as ctx:
            check_usage_quota("user-1", event_type="chat", tokens=1)

        self.assertEqual(ctx.exception.status_code, 429)

    @patch("app.usage.get_effective_quotas")
    @patch("app.usage._daily_usage")
    def test_blocks_when_chat_quota_exceeded(self, mock_daily_usage, mock_quotas):
        mock_quotas.return_value = {"tokens": 1000, "chats": 2, "tasks": 10}
        mock_daily_usage.return_value = {"tokens": 10, "chats": 2, "tasks": 0}

        with self.assertRaises(HTTPException) as ctx:
            check_usage_quota("user-1", event_type="chat")

        self.assertEqual(ctx.exception.status_code, 429)


if __name__ == "__main__":
    unittest.main()