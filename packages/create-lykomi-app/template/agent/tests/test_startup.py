"""Verify the actual endpoint and skill catalogue without making a model call."""

import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient


class StartupTests(unittest.TestCase):
    def test_app_mounts_with_explicit_single_user_scope_and_lists_skills(self):
        with patch.dict(os.environ, {
            "FOUNDRY_PROJECT_ENDPOINT": "https://example.services.ai.azure.com/api/projects/starter-test",
            "FOUNDRY_MODEL": "test-deployment",
        }):
            from app.main import app

            with TestClient(app) as client:
                response = client.get("/api/chat/config")
                self.assertEqual(response.status_code, 200)
                self.assertIn("plan-work", [row["name"] for row in response.json()["skills"]])
                self.assertTrue(any(route.path == "/api/agent" for route in app.routes))
