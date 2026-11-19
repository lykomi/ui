import copy
import unittest
from unittest.mock import patch

import dependency_automation as automation


HEAD = "a" * 40
MESSAGE = """Bump example

---
updated-dependencies:
- dependency-name: example
  dependency-version: 1.3.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot]
"""
COMMIT = {
    "sha": HEAD,
    "author": {"id": automation.DEPENDABOT},
    "committer": {"id": 19864447},
    "parents": [{"sha": "b" * 40}],
    "commit": {"message": MESSAGE, "verification": {"verified": True}},
}


class AutomationTests(unittest.TestCase):
    def test_only_complete_signed_bot_minor_patch_records_are_routine(self):
        self.assertTrue(automation.routine_updates([COMMIT])[0])
        for mutation in [
            {"author": {"id": 1}},
            {"committer": {"id": 1}},
            {"parents": [{}, {}]},
            {"commit": {"message": MESSAGE, "verification": {"verified": False}}},
        ]:
            with self.subTest(mutation=mutation):
                self.assertFalse(
                    automation.routine_updates([{**COMMIT, **mutation}])[0]
                )
        for old, new in [
            ("semver-minor", "semver-major"),
            ("1.3.0", "0.3.0"),
            ("1.3.0", "1.3.0-beta.1"),
            ("example", "@ag-ui/client"),
            ("example", "agent-framework-core"),
            ("example", "PyJWT"),
            ("example", "Authlib"),
            ("example", "cryptography"),
            ("example", "requests_oauthlib"),
            ("update-type:", "unknown-type:"),
        ]:
            changed = copy.deepcopy(COMMIT)
            changed["commit"]["message"] = MESSAGE.replace(old, new)
            self.assertFalse(automation.routine_updates([changed])[0])

    def test_mixed_group_cannot_hide_a_major(self):
        changed = copy.deepcopy(COMMIT)
        changed["commit"]["message"] = MESSAGE.replace(
            "\n...\n",
            "\n- dependency-name: other\n  dependency-version: 2.0.0\n  update-type: version-update:semver-major\n...\n",
        )
        self.assertFalse(automation.routine_updates([changed])[0])

    def test_missing_duplicate_and_complex_metadata_fail_closed(self):
        for text in [
            "",
            MESSAGE + MESSAGE,
            MESSAGE.replace("  dependency-version:", "  dependency-name:"),
            MESSAGE.replace(
                "example\n  dependency-version", "[example]\n  dependency-version"
            ),
        ]:
            with self.assertRaises(ValueError):
                automation.dependency_records(text)

    def test_review_requires_numeric_identity_signature_and_final_head(self):
        receipt = {
            "user": {"id": automation.CODEX},
            "body": "Codex Review: Didn't find any major issues.\n**Reviewed commit:** `aaaaaaaaaa`",
        }
        self.assertTrue(automation.reviewed(HEAD, [], [receipt]))
        self.assertTrue(
            automation.reviewed(
                HEAD,
                [],
                [
                    {
                        **receipt,
                        "body": "<!-- codex-review-receipt:v1 -->\n\n"
                        + receipt["body"],
                    }
                ],
            )
        )
        for prefix in ["Summary: ", "> "]:
            self.assertFalse(
                automation.reviewed(
                    HEAD, [], [{**receipt, "body": prefix + receipt["body"]}]
                )
            )
        self.assertFalse(automation.reviewed("c" * 40, [], [receipt]))
        self.assertFalse(
            automation.reviewed(HEAD, [], [{**receipt, "user": {"id": 1}}])
        )
        self.assertFalse(
            automation.reviewed(
                HEAD,
                [],
                [{**receipt, "body": "Codex Review Summary: Completed aaaaaaaaaa"}],
            )
        )
        review = {
            "user": {"id": automation.CODEX},
            "commit_id": HEAD,
            "state": "COMMENTED",
            "body": "### 💡 Codex Review\nFinding",
        }
        self.assertTrue(automation.reviewed(HEAD, [review], []))
        for state in ["PENDING", "DISMISSED"]:
            self.assertFalse(
                automation.reviewed(HEAD, [{**review, "state": state}], [])
            )

    def test_strict_protection_requires_all_expected_trusted_checks(self):
        rule = {
            "type": "required_status_checks",
            "parameters": {
                "strict_required_status_checks_policy": True,
                "required_status_checks": [
                    {"context": "CI", "integration_id": automation.GITHUB_ACTIONS}
                ],
            },
        }
        with patch.object(automation, "pages", return_value=[rule]):
            self.assertTrue(automation.strict_protection("lykomi/lykomi"))
            self.assertFalse(automation.strict_protection("lykomi/ui"))
        rule["parameters"]["strict_required_status_checks_policy"] = False
        with patch.object(automation, "pages", return_value=[rule]):
            self.assertFalse(automation.strict_protection("lykomi/lykomi"))

    def test_changed_head_is_not_merged_and_per_run_limit_is_one(self):
        prs = [{"number": n, "user": {"id": automation.DEPENDABOT}} for n in [1, 2, 3]]
        decisions = [
            {"number": 1, "head": HEAD, "eligible": True, "reason": "ok"},
            {"number": 1, "head": "b" * 40, "eligible": True, "reason": "ok"},
            {"number": 2, "head": HEAD, "eligible": True, "reason": "ok"},
            {"number": 2, "head": HEAD, "eligible": True, "reason": "ok"},
            {"number": 3, "head": HEAD, "eligible": True, "reason": "ok"},
        ]
        with (
            patch.object(automation, "pages", return_value=prs),
            patch.object(automation, "decision", side_effect=decisions),
            patch.object(
                automation, "gh", return_value={"merged": True, "sha": "d" * 40}
            ) as merge,
        ):
            result = automation.run("lykomi/lykomi", True)
        self.assertEqual(result["merged"], 1)
        self.assertEqual(merge.call_count, 1)
        self.assertIn("repos/lykomi/lykomi/pulls/2/merge", merge.call_args.args)
        self.assertIn("sha=" + HEAD, merge.call_args.args)

    def test_decision_rejects_stale_base_checks_findings_and_unexpected_files(self):
        repo = "lykomi/lykomi"
        prefix = "repos/" + repo
        values = {
            "pr": {
                "number": 1,
                "state": "open",
                "draft": False,
                "user": {"id": automation.DEPENDABOT},
                "head": {
                    "sha": HEAD,
                    "ref": "dependabot/uv/example",
                    "repo": {"full_name": repo},
                },
                "base": {"ref": "main"},
                "commits": 1,
                "changed_files": 1,
                "mergeable": True,
                "mergeable_state": "clean",
            },
            "commits": [COMMIT],
            "files": [{"filename": "apps/spaces/uv.lock", "status": "modified"}],
            "reviews": [
                {
                    "user": {"id": automation.CODEX},
                    "commit_id": HEAD,
                    "state": "COMMENTED",
                    "body": "### 💡 Codex Review",
                }
            ],
            "comments": [],
            "behind": 0,
            "unresolved": False,
            "strict": True,
            "checks": [
                {
                    "name": "CI",
                    "app": {"id": automation.GITHUB_ACTIONS},
                    "status": "completed",
                    "conclusion": "success",
                }
            ],
        }

        def evaluate(data):
            def api(path):
                if path == prefix + "/pulls/1":
                    return data["pr"]
                if path == prefix + "/compare/main..." + HEAD:
                    return {"behind_by": data["behind"]}
                self.fail("unexpected API query: " + path)

            def pages(path, key=None):
                if path.startswith(prefix + "/commits/"):
                    return data["checks"]
                return data[path.split("?")[0].rsplit("/", 1)[1]]

            with (
                patch.object(automation, "api", side_effect=api),
                patch.object(automation, "pages", side_effect=pages),
                patch.object(
                    automation, "unresolved_threads", return_value=data["unresolved"]
                ),
                patch.object(
                    automation, "strict_protection", return_value=data["strict"]
                ),
            ):
                return automation.decision(repo, 1)

        self.assertTrue(evaluate(values)["eligible"])
        changes = [
            {"behind": 1},
            {"unresolved": True},
            {"strict": False},
            {"files": [{"filename": ".github/workflows/ci.yml", "status": "modified"}]},
            {"reviews": [{**values["reviews"][0], "commit_id": "c" * 40}]},
            {
                "reviews": [
                    *values["reviews"],
                    {"user": {"id": 1}, "state": "CHANGES_REQUESTED"},
                ]
            },
            {"checks": [{**values["checks"][0], "conclusion": "failure"}]},
            {"checks": [{**values["checks"][0], "app": {"id": 1}}]},
            {"checks": [{**values["checks"][0], "status": "in_progress"}]},
            {"pr": {**values["pr"], "changed_files": 2}},
            {"pr": {**values["pr"], "mergeable": None}},
            {"pr": {**values["pr"], "draft": True}},
        ]
        for change in changes:
            with self.subTest(change=change):
                self.assertFalse(evaluate({**values, **change})["eligible"])


if __name__ == "__main__":
    unittest.main()
