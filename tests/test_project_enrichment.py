import json
import tempfile
import unittest
from pathlib import Path

from skill.scripts.action_protocol import create_action
from skill.scripts.claude_import import apply_web_action
from skill.scripts.project_actions import enrich_project


class ProjectEnrichmentTests(unittest.TestCase):
    def make_project(self, root: Path):
        folder = root / "my-project"
        folder.mkdir()
        (folder / "project.json").write_text(json.dumps({
            "id": "p-1", "slug": "my-project", "title": "My Project",
            "source_refs": ["chat:1"], "existing": "preserve",
        }))
        return folder / "project.json"

    def test_project_enrich_action_allows_only_identifier_sector_and_one_liner(self):
        action = create_action("project.enrich", "run-1", {
            "project_id": "p-1", "sector": "Developer tools", "one_liner": "A sharper workflow.",
        })
        self.assertEqual(action["action"], "project.enrich")
        with self.assertRaisesRegex(ValueError, "invalid fields"):
            create_action("project.enrich", "run-1", {
                "project_id": "p-1", "sector": "Tools", "one_liner": "Story", "path": "/tmp/unsafe",
            })

    def test_enrichment_updates_project_atomically_and_preserves_other_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            project_json = self.make_project(root)
            result = enrich_project(root, project_id="p-1", sector="Developer tools", one_liner="A sharper workflow.")
            saved = json.loads(project_json.read_text())
            self.assertEqual(result["status"], "applied")
            self.assertEqual(saved["sector"], "Developer tools")
            self.assertEqual(saved["one_liner"], "A sharper workflow.")
            self.assertEqual(saved["existing"], "preserve")
            self.assertEqual(list(root.rglob(".*.tmp")), [])

    def test_apply_web_action_polls_and_writes_result_after_enrichment(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            project_json = self.make_project(root)
            run = root / "imports" / "claude-20260914T120000Z-abcdef"
            (run / "actions").mkdir(parents=True)
            (run / "manifest.json").write_text(json.dumps({"id": run.name}))
            action = create_action("project.enrich", run.name, {
                "project_id": "p-1", "sector": "Developer tools", "one_liner": "A sharper workflow.",
            })
            (run / "actions" / "project-enrich.json").write_text(json.dumps(action))
            result = apply_web_action(data_root=root, run_id=run.name, action_name="project-enrich")
            self.assertEqual(result["status"], "applied")
            self.assertEqual(json.loads(project_json.read_text())["sector"], "Developer tools")
            self.assertEqual(json.loads((run / "results" / "project-enrich.json").read_text())["status"], "applied")


if __name__ == "__main__":
    unittest.main()
