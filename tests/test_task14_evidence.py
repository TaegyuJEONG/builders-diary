import json
import tempfile
import unittest
from pathlib import Path

from skill.scripts.save_record import extract_evidence_candidates, materialize_approved_evidence
from skill.scripts.claude_import import _validate_task_approve_action


class Task14EvidenceTests(unittest.TestCase):
    def test_extracts_safe_metadata_for_all_supported_evidence_kinds(self):
        candidates = extract_evidence_candidates([
            {"type": "artifact", "label": "design.png", "source_path": "/private/work/design.png"},
            {"type": "artifact", "label": "spreadsheet.xlsx", "source_path": "/private/work/data.xlsx"},
            {"type": "artifact", "label": "brief.docx", "source_path": "/private/work/brief.docx"},
            {"type": "artifact", "label": "commit abc", "url": "https://github.com/a/b/commit/abc"},
            {"type": "artifact", "label": "deployed app", "url": "https://example.com"},
            {"type": "artifact", "label": "notes.log", "source_path": "/private/work/notes.log"},
            {"type": "artifact", "label": "reference URL", "url": "https://example.org/docs"},
            {"type": "quote", "label": "User quote", "quote": "Keep it simple."},
        ])
        self.assertEqual({item["kind"] for item in candidates}, {"file", "image", "spreadsheet", "document", "commit", "deployment", "url", "quote"})
        self.assertNotIn("source_path", json.dumps(candidates))
        self.assertTrue(all(item["verified"] is False for item in candidates))

    def test_approval_rejects_unallowlisted_evidence_fields_and_invalid_visibility(self):
        action = {"action": "task.approve", "run_id": "run-1", "task": {
            "project": "P", "goal": "G", "stage": "Build", "title": "T", "date": "2026-01-01",
            "activity": [], "purpose": "", "tools": [], "mindset": [], "body": "Body",
            "evidence": [{"label": "x", "visibility": "public", "source_path": "/tmp/x"}], "highlight": None,
        }}
        with self.assertRaisesRegex(ValueError, "evidence"):
            _validate_task_approve_action(action, "run-1")

    def test_only_approved_source_inside_allowed_root_is_materialized(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "safe.txt"
            source.write_text("safe")
            record = root / "record"
            evidence = [{"kind": "file", "label": "Safe", "visibility": "approved", "source_path": str(source), "artifact_path": "safe.txt"}]
            materialize_approved_evidence(str(record), evidence, allowed_source_root=root)
            self.assertEqual((record / "evidence" / "safe.txt").read_text(), "safe")

    def test_missing_evidence_does_not_block_save(self):
        with tempfile.TemporaryDirectory() as tmp:
            evidence = [{"kind": "file", "label": "Missing", "verified": False, "visibility": "unverified"}]
            result = materialize_approved_evidence(tmp, evidence)
            self.assertEqual(result, evidence)


if __name__ == "__main__":
    unittest.main()
