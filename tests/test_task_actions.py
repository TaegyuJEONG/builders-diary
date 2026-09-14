import json
import tempfile
import unittest
from pathlib import Path

from skill.scripts.task_actions import merge_tasks, split_task


class TaskActionsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self._project("p", "Project", "g", "Purpose")

    def tearDown(self):
        self.tmp.cleanup()

    def _project(self, slug, title, goal, goal_title):
        p = self.root / slug
        p.mkdir(parents=True, exist_ok=True)
        (p / "project.json").write_text(json.dumps({"id": f"p-{slug}", "slug": slug, "title": title}))
        g = p / goal
        g.mkdir()
        (g / "goal.json").write_text(json.dumps({"id": f"g-{goal}", "slug": goal, "title": goal_title, "project_slug": slug}))

    def _task(self, rid, folder, body, **extra):
        d = self.root / "p" / "g" / folder
        d.mkdir()
        record = {"id": rid, "folder": folder, "title": folder, "date": "2026-01-01",
                  "section": "Build", "body": body, "body_md": body,
                  "activities": [], "tools": [], "mindset": [], "evidence": [],
                  "project_id": "p-p", "project_slug": "p", "goal_id": "g-g",
                  "goal_slug": "g", "goal_title": "Purpose", "source_refs": []}
        record.update(extra)
        (d / "record.json").write_text(json.dumps(record))
        return d / "record.json"

    def test_merge_unions_fields_and_leaves_source_redirect(self):
        target = self._task("r-target", "20260101-000-target", "## Work\nTarget", activities=["Research"], tools=["Python"], source_refs=["src-a"])
        source = self._task("r-source", "20260101-001-source", "## Work\nSource", activities=["Research", "Interview"], tools=["Python", "Claude"], mindset=["Skeptical"], evidence=[{"type": "quote", "label": "Q"}], source_refs=["src-b"])
        result = merge_tasks(self.root, target_id="r-target", source_id="r-source")
        merged = json.loads(target.read_text())
        redirect = json.loads(source.read_text())
        self.assertEqual(result["status"], "applied")
        self.assertEqual(merged["activities"], ["Research", "Interview"])
        self.assertEqual(merged["tools"], ["Python", "Claude"])
        self.assertEqual(merged["source_refs"], ["src-a", "src-b"])
        self.assertIn("Source", merged["body_md"])
        self.assertEqual(redirect["merged_into"]["id"], "r-target")

    def test_merge_rolls_back_when_source_is_invalid(self):
        target = self._task("r-target", "20260101-000-target", "Target")
        before = target.read_text()
        with self.assertRaises(ValueError):
            merge_tasks(self.root, target_id="r-target", source_id="missing")
        self.assertEqual(target.read_text(), before)

    def test_split_requires_two_children_and_redirects_source(self):
        source = self._task("r-source", "20260101-000-source", "Original", title="Original")
        result = split_task(self.root, source_id="r-source", children=[
            {"title": "Child one", "body": "One", "goal": "g", "stage": "Build"},
            {"title": "Child two", "body": "Two", "goal": "g", "stage": "Build"},
        ])
        redirect = json.loads(source.read_text())
        self.assertEqual(result["status"], "applied")
        self.assertEqual(len(result["child_ids"]), 2)
        self.assertEqual(len(redirect["split_into"]), 2)
        child_records = [json.loads(path.read_text()) for path in self.root.glob("**/record.json") if path != source]
        self.assertEqual({record["id"] for record in child_records}, set(result["child_ids"]))

    def test_split_rejects_one_child_without_mutation(self):
        source = self._task("r-source", "20260101-000-source", "Original")
        before = source.read_text()
        with self.assertRaises(ValueError):
            split_task(self.root, source_id="r-source", children=[{"title": "Only", "body": "x"}])
        self.assertEqual(source.read_text(), before)


if __name__ == "__main__":
    unittest.main()
