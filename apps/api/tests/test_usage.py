import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.usage import check_usage_quota


class UsageQuotaTests(unittest.TestCase):
    @patch("app.usage._daily_usage")
    @patch("app.usage.get_settings")
    def test_blocks_when_token_quota_exceeded(self, mock_settings, mock_daily_usage):
        mock_settings.return_value.daily_token_quota = 100
        mock_settings.return_value.daily_chat_quota = 10
        mock_settings.return_value.daily_task_quota = 10
        mock_daily_usage.return_value = {"tokens": 100, "chats": 0, "tasks": 0}

        with self.assertRaises(HTTPException) as ctx:
            check_usage_quota("user-1", event_type="chat", tokens=1)

        self.assertEqual(ctx.exception.status_code, 429)

    @patch("app.usage._daily_usage")
    @patch("app.usage.get_settings")
    def test_blocks_when_chat_quota_exceeded(self, mock_settings, mock_daily_usage):
        mock_settings.return_value.daily_token_quota = 1000
        mock_settings.return_value.daily_chat_quota = 2
        mock_settings.return_value.daily_task_quota = 10
        mock_daily_usage.return_value = {"tokens": 10, "chats": 2, "tasks": 0}

        with self.assertRaises(HTTPException) as ctx:
            check_usage_quota("user-1", event_type="chat")

        self.assertEqual(ctx.exception.status_code, 429)


if __name__ == "__main__":
    unittest.main()