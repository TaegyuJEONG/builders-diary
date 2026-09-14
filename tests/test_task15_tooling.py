import json
import tempfile
import unittest
from pathlib import Path

from skill.scripts import save_record
from skill.scripts import claude_import


class Task15ToolingTaxonomyTests(unittest.TestCase):
    def test_tooling_metadata_uses_only_canonical_categories_and_preserves_flattened_tools(self):
        result = save_record.normalize_tooling_metadata({
            "Programming languages": ["Python"],
            "MCP servers": ["Filesystem MCP"],
            "Skills": ["Builders Diary"],
            "Coding agents": ["Claude Code"],
            "AI models": ["GPT-5"],
            "AI frameworks": ["Next.js"],
            "Apps/platforms": ["GitHub"],
            "Other": ["SQLite"],
        })
        self.assertEqual(result["tool_categories"]["MCP servers"], ["Filesystem MCP"])
        self.assertEqual(result["tools"], ["Python", "Filesystem MCP", "Builders Diary", "Claude Code", "GPT-5", "Next.js", "GitHub", "SQLite"])

    def test_tooling_metadata_rejects_unknown_category_instead_of_inference(self):
        with self.assertRaisesRegex(ValueError, "unknown tool category"):
            save_record.normalize_tooling_metadata({"Data / backend": ["SQLite"]})

    def test_observed_source_metadata_is_the_only_classification_input(self):
        source = {"tooling_metadata": {"AI models": ["Model from source"]}}
        result = claude_import.tooling_from_source_metadata(source)
        self.assertEqual(result["tool_categories"]["AI models"], ["Model from source"])
        self.assertEqual(result["tools"], ["Model from source"])
        self.assertEqual(claude_import.tooling_from_source_metadata({"title": "AI model project"})["tools"], [])

    def test_task_approval_accepts_tool_categories_and_requires_canonical_values(self):
        action = {
            "action": "task.approve", "run_id": "run-1",
            "task": {
                "project": "Project", "goal": "Purpose", "stage": "Build",
                "title": "Task", "date": "2026-09-14", "body": "Body",
                "tool_categories": {"Programming languages": ["Python"]},
            },
        }
        task = claude_import._validate_task_approve_action(action, "run-1")
        self.assertEqual(task["tool_categories"], {"Programming languages": ["Python"]})

        action["task"]["tool_categories"] = {"Research / validation": ["Guess"]}
        with self.assertRaisesRegex(ValueError, "unknown tool category"):
            claude_import._validate_task_approve_action(action, "run-1")


if __name__ == "__main__":
    unittest.main()
