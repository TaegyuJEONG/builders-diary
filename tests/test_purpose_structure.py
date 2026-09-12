#!/usr/bin/env python3
"""Regression tests for Project → Purpose(stage) → Task storage."""

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "skill" / "scripts" / "save_record.py"


class PurposeStructureTests(unittest.TestCase):
    def test_failed_evidence_copy_rolls_back_new_project_and_purpose(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "portfolio"
            evidence = Path(tmp) / "evidence.json"
            evidence.write_text(
                json.dumps(
                    [
                        {
                            "type": "artifact",
                            "visibility": "approved",
                            "source_path": str(Path(tmp) / "missing.txt"),
                        }
                    ]
                ),
                encoding="utf-8",
            )
            result = subprocess.run(
                [
                    "python3", str(SCRIPT),
                    "--root", str(root),
                    "--project", "Rollback Project",
                    "--goal", "Rollback Purpose",
                    "--stage", "Build",
                    "--title", "Must not partially save",
                    "--evidence-file", str(evidence),
                ],
                capture_output=True,
                text=True,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((root / "rollback-project" / "project.json").exists())
            self.assertFalse((root / "rollback-project" / "rollback-purpose" / "goal.json").exists())
            self.assertEqual(list(root.glob("**/record.json")), [])

    def test_explicit_source_date_controls_record_date_and_folder(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "portfolio"
            result = subprocess.run(
                [
                    "python3", str(SCRIPT),
                    "--root", str(root),
                    "--project", "Chronological Project",
                    "--goal", "Discovery",
                    "--stage", "Think",
                    "--title", "Read the earliest source",
                    "--date", "2026-03-15",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            summary = json.loads(result.stdout)
            record = Path(summary["path"])
            saved = json.loads(record.read_text(encoding="utf-8"))

            self.assertTrue(record.parent.name.startswith("20260315-000-"))
            self.assertEqual(saved["date"], "2026-03-15")

    def test_new_goal_and_stage_keep_purpose_distinct_from_task_aim(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "portfolio"
            body = Path(tmp) / "body.md"
            body.write_text("## Context\nA tested task.\n", encoding="utf-8")
            result = subprocess.run(
                [
                    "python3", str(SCRIPT),
                    "--root", str(root),
                    "--project", "Product Builder Jobs",
                    "--goal", "Curation Taxonomy",
                    "--stage", "Discovery",
                    "--title", "Define Product Builder boundaries",
                    "--purpose", "Separate hands-on builders from adjacent roles.",
                    "--body-file", str(body),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            summary = json.loads(result.stdout)
            goal = root / "product-builder-jobs" / "curation-taxonomy" / "goal.json"
            record = Path(summary["path"])

            self.assertEqual(summary["section"], "Discovery")
            self.assertTrue(goal.is_file())
            self.assertEqual(json.loads(goal.read_text(encoding="utf-8"))["title"], "Curation Taxonomy")
            # A Purpose spans the lifecycle, so it carries no stage of its own.
            self.assertNotIn("stage", json.loads(goal.read_text(encoding="utf-8")))
            saved = json.loads(record.read_text(encoding="utf-8"))
            self.assertEqual(saved["goal_title"], "Curation Taxonomy")
            self.assertEqual(saved["section"], "Discovery")
            self.assertEqual(saved["purpose"], "Separate hands-on builders from adjacent roles.")

    def test_legacy_section_only_call_keeps_existing_section_as_purpose(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "portfolio"
            result = subprocess.run(
                [
                    "python3", str(SCRIPT),
                    "--root", str(root),
                    "--project", "Legacy Project",
                    "--section", "Build",
                    "--title", "Legacy task",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            summary = json.loads(result.stdout)
            goal = root / "legacy-project" / "build" / "goal.json"
            self.assertEqual(summary["section"], "Build")
            self.assertEqual(json.loads(goal.read_text(encoding="utf-8"))["title"], "Build")
            self.assertNotIn("stage", json.loads(goal.read_text(encoding="utf-8")))


if __name__ == "__main__":
    unittest.main()
