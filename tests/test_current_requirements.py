from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class CurrentRequirementsTests(unittest.TestCase):
    def test_import_skill_is_english_and_keeps_three_download_links(self):
        text = (ROOT / "import-skill" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("The viewer origin comes **only** from the copied `Viewer: <origin>` line", text)
        self.assertIn("https://web-one-alpha-57.vercel.app", text)
        self.assertIn("Conversations", text)
        self.assertIn("Projects", text)
        self.assertIn("Memories", text)
        self.assertNotIn("Only if the user explicitly chooses to skip", text)
        self.assertNotRegex(text, r"[\uac00-\ud7a3]")

    def test_project_first_contract_is_explicit_and_honest(self):
        helper = (ROOT / "skill" / "scripts" / "claude_import.py").read_text(encoding="utf-8")
        skill = (ROOT / "import-skill" / "SKILL.md").read_text(encoding="utf-8")
        for text in (helper, skill):
            self.assertIn("project-first", text.lower())
            self.assertIn("project_selection", text)
            self.assertIn("source_task_curation", text)
        self.assertIn('"phase": "project_first"', helper)

    def test_obsolete_visible_components_are_not_rendered(self):
        home = (ROOT / "web" / "src" / "app" / "home-content.tsx").read_text(encoding="utf-8")
        self.assertNotIn("<FirstRecordBanner", home)
        self.assertNotIn("<ProjectEnrichmentQueue", home)


if __name__ == "__main__":
    unittest.main()
