#!/usr/bin/env python3
"""Regression tests for the Discovery/Build/Growth stage vocabulary.

Stages are user-editable: the defaults ship with the skill, but a builder can
add, rename, remove, or reorder them via stages.json in their own data root.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "skill" / "scripts" / "save_record.py"


def save(root: Path, **flags: str) -> dict:
    args = ["python3", str(SCRIPT), "--root", str(root)]
    for key, value in flags.items():
        args.extend([f"--{key.replace('_', '-')}", value])
    result = subprocess.run(args, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


class StageVocabularyTests(unittest.TestCase):
    def test_default_stages_are_discovery_build_growth(self) -> None:
        import sys

        sys.path.insert(0, str(ROOT))
        from skill.scripts.save_record import load_stages

        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual([s["name"] for s in load_stages(tmp)], ["Discovery", "Build", "Growth"])

    def test_legacy_seven_stage_names_map_into_three_buckets(self) -> None:
        import sys

        sys.path.insert(0, str(ROOT))
        from skill.scripts.save_record import normalize_stage

        with tempfile.TemporaryDirectory() as tmp:
            cases = {
                "Think": "Discovery",
                "Plan": "Discovery",
                "Build": "Build",
                "Review": "Build",
                "Test": "Build",
                "Ship": "Growth",
                "Reflect": "Growth",
                "Research": "Discovery",
                "Planning": "Discovery",
                "Design": "Build",
                "Engineering": "Build",
                "Growth": "Growth",
            }
            for legacy, expected in cases.items():
                self.assertEqual(normalize_stage(tmp, legacy), expected, f"{legacy} should map to {expected}")

    def test_user_defined_stage_is_accepted_and_ordered(self) -> None:
        import sys

        sys.path.insert(0, str(ROOT))
        from skill.scripts.save_record import load_stages, normalize_stage

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            root.mkdir(parents=True, exist_ok=True)
            (root / "stages.json").write_text(
                json.dumps(
                    {
                        "stages": [
                            {"name": "Discovery"},
                            {"name": "Build"},
                            {"name": "Launch"},
                            {"name": "Reflect"},
                        ]
                    }
                ),
                encoding="utf-8",
            )

            self.assertEqual(
                [s["name"] for s in load_stages(root)],
                ["Discovery", "Build", "Launch", "Reflect"],
            )
            # A custom stage passes through untouched.
            self.assertEqual(normalize_stage(root, "Launch"), "Launch")
            # Reflect is user-defined here, so it must NOT collapse into Growth.
            self.assertEqual(normalize_stage(root, "Reflect"), "Reflect")

    def test_unknown_stage_is_kept_rather_than_silently_dropped(self) -> None:
        import sys

        sys.path.insert(0, str(ROOT))
        from skill.scripts.save_record import normalize_stage

        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(normalize_stage(tmp, "Fundraising"), "Fundraising")


class PurposeStageIndependenceTests(unittest.TestCase):
    def test_purpose_does_not_inherit_or_overwrite_task_stage(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "portfolio"
            save(
                root, project="P", goal="Grow the job board", stage="Discovery",
                title="Explore candidate acquisition", date="2026-06-14",
            )
            save(
                root, project="P", goal="Grow the job board", stage="Growth",
                title="Write accelerator pitch", date="2026-07-19",
            )

            goal = json.loads((root / "p" / "grow-the-job-board" / "goal.json").read_text(encoding="utf-8"))
            self.assertNotIn("stage", goal, "Purpose must not carry a lifecycle stage")

            records = sorted(root.glob("p/grow-the-job-board/*/record.json"))
            stages = [json.loads(r.read_text(encoding="utf-8"))["section"] for r in records]
            self.assertEqual(stages, ["Discovery", "Growth"], "Each Task keeps its own stage")

    def test_legacy_stage_flag_is_normalized_on_save(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "portfolio"
            summary = save(root, project="P", goal="Purpose", stage="Ship", title="Legacy stage task")
            self.assertEqual(summary["section"], "Growth")


class EntryTypeTests(unittest.TestCase):
    def test_learning_entries_are_typed_separately_from_projects(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "portfolio"
            save(
                root, project="Agent client deployment", type="learning",
                goal="MCP and Skills", stage="Discovery", title="Compare MCP vs Skills packaging",
            )

            meta = json.loads((root / "agent-client-deployment" / "project.json").read_text(encoding="utf-8"))
            record = json.loads(next(root.glob("agent-client-deployment/*/*/record.json")).read_text(encoding="utf-8"))
            self.assertEqual(meta["type"], "learning")
            self.assertEqual(record["entry_type"], "learning")

    def test_project_is_the_default_entry_type(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "portfolio"
            save(root, project="P", goal="Purpose", stage="Build", title="A task")
            meta = json.loads((root / "p" / "project.json").read_text(encoding="utf-8"))
            self.assertEqual(meta["type"], "project")


class ActivityTests(unittest.TestCase):
    def test_activities_are_saved_as_explicit_task_methods(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "portfolio"
            save(
                root,
                project="P",
                goal="Validate demand",
                stage="Discovery",
                activity="Research, User Interview",
                title="Interview early users",
            )
            record = json.loads(next(root.glob("p/*/*/record.json")).read_text(encoding="utf-8"))
            self.assertEqual(record["activities"], ["Research", "User Interview"])

    def test_activities_default_to_empty_list(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "portfolio"
            save(root, project="P", goal="Purpose", stage="Build", title="A task")
            record = json.loads(next(root.glob("p/*/*/record.json")).read_text(encoding="utf-8"))
            self.assertEqual(record["activities"], [])


class OrderingTests(unittest.TestCase):
    def test_explicit_task_order_is_persisted(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "portfolio"
            save(root, project="P", goal="Purpose", stage="Build", order="42", title="Ordered task")
            record = json.loads(next(root.glob("p/*/*/record.json")).read_text(encoding="utf-8"))
            self.assertEqual(record["order"], 42)


if __name__ == "__main__":
    unittest.main()
