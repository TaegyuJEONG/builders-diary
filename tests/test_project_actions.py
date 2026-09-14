import json
import tempfile
import unittest
from pathlib import Path

from skill.scripts.action_protocol import create_action
from skill.scripts.project_actions import merge_projects


class ProjectMergeTests(unittest.TestCase):
    def make_project(self, root: Path, slug: str, project_id: str, title: str, purpose: dict, tasks: list[dict], **metadata):
        folder = root / slug
        folder.mkdir(parents=True)
        (folder / "project.json").write_text(json.dumps({"id": project_id, "slug": slug, "title": title, **metadata}))
        purpose_folder = folder / purpose["slug"]
        purpose_folder.mkdir()
        (purpose_folder / "goal.json").write_text(json.dumps({"id": purpose["id"], "slug": purpose["slug"], "title": purpose["title"], "project_slug": slug, "source_refs": purpose.get("source_refs", [])}))
        for task in tasks:
            task_folder = purpose_folder / task["folder"]
            task_folder.mkdir()
            (task_folder / "record.json").write_text(json.dumps({"id": task["id"], "folder": task["folder"], "title": task["title"], "project_id": project_id, "project_slug": slug, "project_title": title, "goal_id": purpose["id"], "goal_slug": purpose["slug"], "goal_title": purpose["title"], "source_refs": task.get("source_refs", []), "tools": task.get("tools", [])}))

    def test_merge_moves_purposes_and_rewrites_every_task_breadcrumb(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_project(root, "target", "p-target", "Target", {"id": "g-one", "slug": "one", "title": "One"}, [{"id": "r-a", "folder": "20260101-000-a", "title": "A"}], source_refs=["target-source"], tools=["python"])
            self.make_project(root, "source", "p-source", "Source", {"id": "g-two", "slug": "two", "title": "Two", "source_refs": ["purpose-source"]}, [{"id": "r-b", "folder": "20260102-000-b", "title": "B", "source_refs": ["task-source"], "tools": ["pytest"]}], source_refs=["source-source"], tools=["pytest"])

            result = merge_projects(root, target_slug="target", source_slug="source")

            self.assertEqual(result["target_slug"], "target")
            self.assertTrue((root / "target" / "two" / "20260102-000-b" / "record.json").exists())
            moved = json.loads((root / "target" / "two" / "20260102-000-b" / "record.json").read_text())
            self.assertEqual({moved["project_id"], moved["project_slug"], moved["project_title"]}, {"p-target", "target", "Target"})
            self.assertEqual({moved["goal_id"], moved["goal_slug"], moved["goal_title"]}, {"g-two", "two", "Two"})
            target_meta = json.loads((root / "target" / "project.json").read_text())
            self.assertEqual(set(target_meta["source_refs"]), {"target-source", "source-source"})
            self.assertEqual(set(target_meta["tools"]), {"python", "pytest"})

            redirect = json.loads((root / "source" / "project.json").read_text())
            self.assertEqual(redirect["merged_into"], {"id": "p-target", "slug": "target", "title": "Target"})

    def test_same_purpose_slug_merges_tasks_and_rollback_restores_snapshot(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            purpose = {"id": "g-same", "slug": "same", "title": "Same"}
            self.make_project(root, "target", "p-target", "Target", purpose, [{"id": "r-a", "folder": "20260101-000-a", "title": "A"}])
            self.make_project(root, "source", "p-source", "Source", purpose, [{"id": "r-b", "folder": "20260102-000-b", "title": "B"}])
            merge_projects(root, target_slug="target", source_slug="source")
            self.assertTrue((root / "target" / "same" / "20260101-000-a" / "record.json").exists())
            self.assertTrue((root / "target" / "same" / "20260102-000-b" / "record.json").exists())
            self.assertEqual(json.loads((root / "source" / "project.json").read_text())["merged_into"]["slug"], "target")

    def test_merge_rolls_back_all_moves_when_a_source_purpose_is_invalid(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_project(root, "target", "p-target", "Target", {"id": "g-one", "slug": "one", "title": "One"}, [])
            self.make_project(root, "source", "p-source", "Source", {"id": "g-two", "slug": "two", "title": "Two"}, [])
            (root / "source" / "broken").mkdir()
            with self.assertRaisesRegex(ValueError, "goal.json"):
                merge_projects(root, target_slug="target", source_slug="source")
            self.assertTrue((root / "source" / "two" / "goal.json").exists())
            self.assertTrue((root / "source" / "broken").exists())
            self.assertFalse((root / "target" / "two").exists())

    def test_project_merge_action_is_allowlisted(self):
        action = create_action("project.merge", "run-1", {"target_slug": "target", "source_slug": "source"})
        self.assertEqual(action["action"], "project.merge")


if __name__ == "__main__":
    unittest.main()
