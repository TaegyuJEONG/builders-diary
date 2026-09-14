import datetime as dt
import json
import tempfile
import unittest
import uuid
from pathlib import Path

from skill.scripts.action_protocol import (
    ALLOWED_ACTIONS,
    create_action,
    create_result,
    read_action,
    validate_action,
    write_json_atomic,
)


class ActionProtocolTests(unittest.TestCase):
    def test_create_action_builds_versioned_envelope_with_payload(self):
        run_id = "claude-run-1"
        action = create_action("project.confirm", run_id, {"projects": []})
        self.assertEqual(set(action), {"schema_version", "action_id", "action", "run_id", "created_at", "payload"})
        self.assertEqual(action["schema_version"], 1)
        self.assertEqual(action["action"], "project.confirm")
        self.assertEqual(action["run_id"], run_id)
        uuid.UUID(action["action_id"])
        dt.datetime.fromisoformat(action["created_at"].replace("Z", "+00:00"))
        self.assertEqual(action["payload"], {"projects": []})

    def test_validate_action_rejects_unknown_action_and_extra_top_level_keys(self):
        action = create_action("task.approve", "run-1", {"task": {}})
        with self.assertRaisesRegex(ValueError, "Unsupported web action"):
            create_action("shell.exec", "run-1", {})
        action["unexpected"] = True
        with self.assertRaisesRegex(ValueError, "top-level"):
            validate_action(action, run_id="run-1")

    def test_validate_action_checks_uuid_run_ownership_timestamp_and_payload(self):
        action = create_action("project.confirm", "run-1", {"projects": []})
        for key, value, message in [
            ("action_id", "not-a-uuid", "action_id"),
            ("run_id", "run-2", "run_id"),
            ("created_at", "not-time", "created_at"),
            ("payload", [], "payload"),
        ]:
            broken = dict(action)
            broken[key] = value
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, message):
                validate_action(broken, run_id="run-1")

    def test_legacy_action_is_readable_and_normalized_for_one_release(self):
        legacy = {"action": "task.approve", "run_id": "run-1", "task": {"title": "T"}}
        normalized = validate_action(legacy, run_id="run-1", allow_legacy=True)
        self.assertEqual(normalized["action"], "task.approve")
        self.assertEqual(normalized["payload"], {"task": {"title": "T"}})
        self.assertEqual(normalized["schema_version"], 1)
        self.assertTrue(normalized["action_id"])

    def test_result_envelope_is_idempotent_and_preserves_result(self):
        action_id = str(uuid.uuid4())
        result = create_result(action_id, "applied", {"record_id": "r-1"})
        self.assertEqual(set(result), {"schema_version", "action_id", "status", "applied_at", "result", "error"})
        self.assertEqual(result["action_id"], action_id)
        self.assertEqual(result["result"], {"record_id": "r-1"})
        self.assertIsNone(result["error"])
        with self.assertRaisesRegex(ValueError, "status"):
            create_result(action_id, "unknown", {})

    def test_write_json_atomic_replaces_target_without_leaving_temporary_files(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "nested" / "action.json"
            write_json_atomic(path, {"ok": True})
            self.assertEqual(json.loads(path.read_text()), {"ok": True})
            self.assertEqual(list(path.parent.glob(".*.tmp")), [])

    def test_read_action_validates_allowlisted_action_name(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "action.json"
            path.write_text(json.dumps(create_action("project.confirm", "run-1", {"projects": []})))
            self.assertEqual(read_action(path, run_id="run-1", action_name="project.confirm")["action"], "project.confirm")
            with self.assertRaisesRegex(ValueError, "Unsupported web action"):
                read_action(path, run_id="run-1", action_name="../../x")

    def test_task_drop_is_an_allowlisted_versioned_action(self):
        action = create_action("task.drop", "run-1", {"proposal_id": "proposal-1"})
        self.assertEqual(action["action"], "task.drop")
        self.assertEqual(validate_action(action, run_id="run-1")["payload"], {"proposal_id": "proposal-1"})


if __name__ == "__main__":
    unittest.main()
