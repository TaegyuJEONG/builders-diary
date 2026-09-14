import json
import tempfile
import unittest
from pathlib import Path

from skill.scripts.client_roots import validate_client_roots
from skill.scripts.source_dedup import deduplicate_sources

FIXTURES = Path(__file__).parent / "fixtures" / "release_e2e"


class ReleaseE2EFixtureTests(unittest.TestCase):
    def test_isolated_project_and_task_fixture_has_only_synthetic_records(self):
        data = json.loads((FIXTURES / "project-task-actions.json").read_text())
        self.assertEqual(data["project"]["id"], "fixture-project")
        self.assertEqual({task["id"] for task in data["tasks"]}, {"fixture-task-1", "fixture-task-2"})
        self.assertTrue(all(task["source_refs"][0].startswith("fixture:") for task in data["tasks"]))

    def test_long_chat_fixture_is_paginable_without_loading_real_history(self):
        data = json.loads((FIXTURES / "long-chat.json").read_text())
        messages = data["messages"]
        page_size = data["page_size"]
        pages = [messages[i : i + page_size] for i in range(0, len(messages), page_size)]
        self.assertEqual(len(messages), 105)
        self.assertEqual([len(page) for page in pages], [20, 20, 20, 20, 20, 5])
        self.assertTrue(all(message["id"].startswith("fixture-chat-") for message in messages))

    def test_custom_root_fixture_is_explicit_and_validated(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "custom-client-root"
            root.mkdir()
            config = json.loads((FIXTURES / "custom-root.json").read_text())
            config["claude"][0]["path"] = str(root)
            validated = validate_client_roots(config)
            self.assertEqual(validated["claude"][0]["path"], str(root.resolve()))

    def test_dedup_fixture_collapses_exact_only_and_keeps_semantic_review(self):
        data = json.loads((FIXTURES / "dedup.json").read_text())
        result = deduplicate_sources(data["sources"])
        self.assertEqual(result["unique_sources"], ["fixture:chat-1", "fixture:chat-3"])
        self.assertEqual(result["exact_duplicates"][0]["duplicate_source_refs"], ["fixture:chat-2"])
        self.assertTrue(result["merge_candidates"])


if __name__ == "__main__":
    unittest.main()
