#!/usr/bin/env python3
"""Behavior tests for the local Claude bulk-import helper.

These fixtures are synthetic: tests never read the developer's real Claude export
or ~/.claude directory.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class ClaudeImportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)
        self.export_dir = self.base / "export"
        self.export_dir.mkdir()
        self.config_dir = self.base / "claude"
        self.data_root = self.base / "builders-diary"

        self._write_zip(
            "conversations-001.zip",
            "conversations.json",
            [
                {
                    "uuid": "chat-1",
                    "name": "Product Builder role taxonomy",
                    "summary": "Defined a repeatable Product Builder classification rule.",
                    "created_at": "2026-01-02T00:00:00Z",
                    "updated_at": "2026-01-03T00:00:00Z",
                    "chat_messages": [{"sender": "human", "text": "private raw content"}],
                },
                {
                    "uuid": "chat-2",
                    "name": "",
                    "summary": "",
                    "created_at": "2026-01-04T00:00:00Z",
                    "updated_at": "2026-01-04T00:00:00Z",
                    "chat_messages": [],
                },
            ],
        )
        self._write_zip(
            "projects-001.zip",
            "projects/project-1.json",
            {
                "uuid": "project-1",
                "name": "ProductBuilderJob",
                "description": "Curated job board",
                "docs": [{"uuid": "doc-1", "filename": "brief.md", "content": "private project brief"}],
            },
        )
        self._write_zip(
            "memories-001.zip",
            "memories/account.json",
            {"account_uuid": "account-1", "conversations_memory": "private memory"},
        )
        self._write_zip(
            "light_metadata-001.zip",
            "users.json",
            [{"email_address": "private@example.com", "verified_phone_number": "+111"}],
        )

        sessions = self.config_dir / "projects" / "-Users-demo-ProductBuilderJob"
        sessions.mkdir(parents=True)
        (sessions / "session-a.jsonl").write_text(
            "\n".join(
                [
                    json.dumps({"type": "ai-title", "aiTitle": "Classify Product Builder jobs", "sessionId": "code-1", "cwd": "/Users/demo/ProductBuilderJob", "timestamp": "2026-02-01T00:00:00Z"}),
                    json.dumps({"type": "user", "sessionId": "code-1", "cwd": "/Users/demo/ProductBuilderJob", "message": {"content": "Build an evaluator"}, "timestamp": "2026-02-01T00:01:00Z"}),
                    json.dumps({"type": "assistant", "sessionId": "code-1", "cwd": "/Users/demo/ProductBuilderJob", "message": {"content": "Done"}, "timestamp": "2026-02-01T00:02:00Z"}),
                ]
            ),
            encoding="utf-8",
        )
        subagents = sessions / "session-a" / "subagents"
        subagents.mkdir(parents=True)
        (subagents / "agent-ignored.jsonl").write_text("{}\n", encoding="utf-8")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _write_zip(self, name: str, inner_name: str, data: object) -> None:
        with zipfile.ZipFile(self.export_dir / name, "w") as archive:
            archive.writestr(inner_name, json.dumps(data))

    def test_scan_export_returns_safe_metadata_and_ignores_light_metadata(self) -> None:
        from skill.scripts.claude_import import scan_export_directory

        result = scan_export_directory(self.export_dir)

        self.assertEqual(result["conversation_count"], 2)
        self.assertEqual(result["project_count"], 1)
        self.assertEqual(result["memory_file_count"], 1)
        self.assertEqual(result["conversations"][0]["title"], "Product Builder role taxonomy")
        self.assertEqual(result["conversations"][0]["summary"], "Defined a repeatable Product Builder classification rule.")
        self.assertNotIn("chat_messages", result["conversations"][0])
        self.assertNotIn("light_metadata", result)
        self.assertNotIn("light_metadata", result["archives"])
        self.assertEqual(result["projects"][0]["name"], "ProductBuilderJob")
        self.assertNotIn("docs", result["projects"][0])

    def test_scan_code_sessions_reads_main_sessions_and_skips_subagents(self) -> None:
        from skill.scripts.claude_import import scan_claude_code_sessions

        result = scan_claude_code_sessions(self.config_dir)

        self.assertEqual(result["session_count"], 1)
        session = result["sessions"][0]
        self.assertEqual(session["source_id"], "code-1")
        self.assertEqual(session["title"], "Classify Product Builder jobs")
        self.assertEqual(session["cwd"], "/Users/demo/ProductBuilderJob")
        self.assertEqual(session["first_prompt"], "Build an evaluator")
        self.assertNotIn("subagents", session)

    def test_prepare_run_writes_only_import_state_and_keeps_sources_unchanged(self) -> None:
        from skill.scripts.claude_import import prepare_import_run

        before_export = (self.export_dir / "conversations-001.zip").read_bytes()
        before_session = next((self.config_dir / "projects").rglob("session-a.jsonl")).read_bytes()

        result = prepare_import_run(
            data_root=self.data_root,
            export_dir=self.export_dir,
            claude_config_dir=self.config_dir,
        )

        run_dir = Path(result["run_dir"])
        self.assertTrue((run_dir / "manifest.json").is_file())
        self.assertTrue((run_dir / "source-index.json").is_file())
        self.assertTrue((run_dir / "project-candidates.json").is_file())
        self.assertEqual((self.export_dir / "conversations-001.zip").read_bytes(), before_export)
        self.assertEqual(next((self.config_dir / "projects").rglob("session-a.jsonl")).read_bytes(), before_session)

        candidates = json.loads((run_dir / "project-candidates.json").read_text(encoding="utf-8"))
        self.assertEqual(candidates["schema_version"], 1)
        self.assertTrue(any(c["source"] == "claude_chat_project" for c in candidates["candidates"]))
        self.assertTrue(any(c["source"] == "claude_code_workspace" for c in candidates["candidates"]))
        code_candidate = next(c for c in candidates["candidates"] if c["source"] == "claude_code_workspace")
        self.assertEqual(code_candidate["source_refs"], ["code:code-1"])

    def test_installer_dry_run_includes_daily_and_import_skills(self) -> None:
        result = subprocess.run(
            ["node", str(ROOT / "npm" / "bin" / "cli.js"), "install", "--tools", "claude", "--dry-run"],
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertIn("builders-diary/SKILL.md", result.stdout)
        self.assertIn("builders-diary-import/SKILL.md", result.stdout)

    def test_installer_does_not_install_claude_import_skill_for_other_clients(self) -> None:
        result = subprocess.run(
            ["node", str(ROOT / "npm" / "bin" / "cli.js"), "install", "--tools", "cursor", "--dry-run"],
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertIn("builders-diary/SKILL.md", result.stdout)
        self.assertNotIn("builders-diary-import", result.stdout)

    def test_confirmed_project_materializes_without_eager_purpose(self) -> None:
        from skill.scripts.claude_import import confirm_project, prepare_import_run

        run = prepare_import_run(
            data_root=self.data_root,
            export_dir=self.export_dir,
            claude_config_dir=self.config_dir,
        )
        project = confirm_project(
            data_root=self.data_root,
            run_id=run["run_id"],
            name="Product Builder Jobs",
            sector="Talent discovery",
            one_liner="Curated Product Builder roles from noisy job listings.",
        )
        self.assertEqual(project["slug"], "product-builder-jobs")
        manifest = json.loads((Path(run["run_dir"]) / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["status"], "source_task_curation")
        self.assertEqual(manifest["confirmed_projects"][0]["name"], "Product Builder Jobs")
        self.assertEqual(list(self.data_root.glob("*/*/goal.json")), [])

    def test_confirmed_project_persists_deduplicated_chronological_source_queue(self) -> None:
        from skill.scripts.claude_import import (
            complete_source,
            confirm_project,
            prepare_import_run,
            project_source_queue,
            read_source,
        )

        run = prepare_import_run(
            data_root=self.data_root,
            export_dir=self.export_dir,
            claude_config_dir=self.config_dir,
        )
        confirm_project(
            data_root=self.data_root,
            run_id=run["run_id"],
            name="Product Builder Jobs",
            source_refs=["code:code-1", "chat:chat-1", "chat:chat-1"],
        )

        queue = project_source_queue(
            data_root=self.data_root,
            run_id=run["run_id"],
            project_name="Product Builder Jobs",
        )
        self.assertEqual([item["source_ref"] for item in queue], ["chat:chat-1", "code:code-1"])
        self.assertEqual(queue[0]["created_at"], "2026-01-02T00:00:00Z")

        chat = read_source(data_root=self.data_root, run_id=run["run_id"], project_name="Product Builder Jobs", source_ref="chat:chat-1")
        code = read_source(data_root=self.data_root, run_id=run["run_id"], project_name="Product Builder Jobs", source_ref="code:code-1")
        self.assertEqual(chat["content"]["chat_messages"][0]["text"], "private raw content")
        self.assertTrue(any(row.get("type") == "assistant" for row in code["content"]))

        complete_source(
            data_root=self.data_root,
            run_id=run["run_id"],
            project_name="Product Builder Jobs",
            source_ref="chat:chat-1",
            outcome="dropped",
        )
        remaining = project_source_queue(
            data_root=self.data_root,
            run_id=run["run_id"],
            project_name="Product Builder Jobs",
        )
        self.assertEqual([item["source_ref"] for item in remaining], ["code:code-1"])

        postponed = complete_source(
            data_root=self.data_root,
            run_id=run["run_id"],
            project_name=None,
            source_ref="chat:chat-2",
            outcome="postponed",
        )
        self.assertIsNone(postponed["project_id"])
        self.assertEqual(postponed["outcome"], "postponed")

    def test_read_source_rejects_source_not_selected_for_project(self) -> None:
        from skill.scripts.claude_import import confirm_project, prepare_import_run, read_source

        run = prepare_import_run(
            data_root=self.data_root,
            export_dir=self.export_dir,
            claude_config_dir=self.config_dir,
        )
        confirm_project(
            data_root=self.data_root,
            run_id=run["run_id"],
            name="Product Builder Jobs",
            source_refs=["code:code-1"],
        )
        with self.assertRaisesRegex(ValueError, "not assigned"):
            read_source(
                data_root=self.data_root,
                run_id=run["run_id"],
                project_name="Product Builder Jobs",
                source_ref="chat:chat-1",
            )

    def test_read_source_rejects_tampered_path_outside_claude_sources(self) -> None:
        from skill.scripts.claude_import import confirm_project, prepare_import_run, read_source

        run = prepare_import_run(
            data_root=self.data_root,
            export_dir=self.export_dir,
            claude_config_dir=self.config_dir,
        )
        confirm_project(
            data_root=self.data_root,
            run_id=run["run_id"],
            name="Product Builder Jobs",
            source_refs=["code:code-1"],
        )
        source_index_path = Path(run["run_dir"]) / "source-index.json"
        source_index = json.loads(source_index_path.read_text(encoding="utf-8"))
        secret = self.base / "not-a-claude-source.jsonl"
        secret.write_text('{"secret":"must not be read"}\n', encoding="utf-8")
        source_index["code"]["sessions"][0]["transcript_file"] = str(secret)
        source_index_path.write_text(json.dumps(source_index), encoding="utf-8")

        with self.assertRaisesRegex(ValueError, "outside allowed source root"):
            read_source(data_root=self.data_root, run_id=run["run_id"], project_name="Product Builder Jobs", source_ref="code:code-1")

    def test_run_id_path_traversal_is_rejected(self) -> None:
        from skill.scripts.claude_import import project_source_queue

        with self.assertRaisesRegex(ValueError, "Invalid import run id"):
            project_source_queue(
                data_root=self.data_root,
                run_id="../../outside",
                project_name="Anything",
            )

    def test_run_directory_symlink_cannot_escape_imports_root(self) -> None:
        from skill.scripts.claude_import import project_source_queue

        imports = self.data_root / "imports"
        imports.mkdir(parents=True)
        outside = self.base / "outside-run"
        outside.mkdir()
        (outside / "manifest.json").write_text(
            json.dumps({"confirmed_projects": []}), encoding="utf-8"
        )
        run_id = "claude-20260101T000000Z-abcdef"
        (imports / run_id).symlink_to(outside, target_is_directory=True)

        with self.assertRaisesRegex(ValueError, "outside imports root"):
            project_source_queue(
                data_root=self.data_root,
                run_id=run_id,
                project_name="Anything",
            )

    def test_download_page_contains_only_download_categories(self) -> None:
        from skill.scripts.claude_import import create_download_page

        manifest = self.base / "Claude-Export.json"
        manifest.write_text(
            json.dumps(
                {
                    "data_files": [
                        {"category": "conversations", "filename": "conversations-001.zip", "export_url": "https://example.test/conversations"},
                        {"category": "projects", "filename": "projects-001.zip", "export_url": "https://example.test/projects"},
                        {"category": "memories", "filename": "memories-001.zip", "export_url": "https://example.test/memories"},
                        {"category": "light_metadata", "filename": "light_metadata-001.zip", "export_url": "https://example.test/private"},
                    ]
                }
            ),
            encoding="utf-8",
        )
        page = self.base / "download-claude-export.html"

        create_download_page(manifest, page)
        html = page.read_text(encoding="utf-8")

        self.assertIn("Conversations", html)
        self.assertIn("Projects", html)
        self.assertIn("Memories", html)
        self.assertNotIn("light_metadata", html)
        self.assertNotIn("example.test/private", html)
        self.assertEqual(page.stat().st_mode & 0o777, 0o600)

    def test_download_page_rejects_non_https_urls(self) -> None:
        from skill.scripts.claude_import import create_download_page

        manifest = self.base / "tampered-export.json"
        manifest.write_text(
            json.dumps(
                {
                    "data_files": [
                        {
                            "category": "conversations",
                            "filename": "conversations-001.zip",
                            "export_url": "javascript:alert(document.cookie)",
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            create_download_page(manifest, self.base / "unsafe.html")

    def test_skill_opens_with_live_viewer_preflight(self) -> None:
        skill = (ROOT / "npm" / "import-skill" / "SKILL.md").read_text(encoding="utf-8")
        viewer = skill.index("http://localhost:3111")
        prepare = skill.index(" prepare ")
        helper_help = skill.index(" --help")

        self.assertLess(viewer, prepare)
        self.assertLess(viewer, helper_help)
        self.assertIn("curl", skill[:prepare])
        self.assertIn("another window", skill[:prepare].lower())
        self.assertIn("live", skill[:prepare].lower())

    def test_project_confirmation_is_multiselect_with_free_text_other(self) -> None:
        skill = (ROOT / "npm" / "import-skill" / "SKILL.md").read_text(encoding="utf-8")

        self.assertIn("AskUserQuestion", skill)
        self.assertIn("multiSelect: true", skill)
        self.assertIn("Other", skill)
        self.assertIn("free-text", skill)
        self.assertIn("Next", skill)

    def test_sources_are_processed_oldest_first_with_lazy_purpose_creation(self) -> None:
        skill = (ROOT / "npm" / "import-skill" / "SKILL.md").read_text(encoding="utf-8")
        chronological = skill.index("oldest first")
        read_full = skill.index("Read the full", chronological)
        confirm_card = skill.index("approve", read_full)
        create_purpose = skill.index("Purpose", confirm_card)

        self.assertLess(chronological, read_full)
        self.assertLess(read_full, confirm_card)
        self.assertLess(confirm_card, create_purpose)
        self.assertIn("Do not pre-create", skill)
        self.assertIn("--date", skill)
        self.assertIn("--source-ref", skill)
        self.assertIn("source-queue", skill)
        self.assertIn("read-source", skill)
        self.assertIn("complete-source", skill)

    def test_import_helper_does_not_expose_eager_confirm_purpose_command(self) -> None:
        helper = ROOT / "skill" / "scripts" / "claude_import.py"
        result = subprocess.run(["python3", str(helper), "--help"], check=True, capture_output=True, text=True)

        self.assertNotIn("confirm-purpose", result.stdout)


if __name__ == "__main__":
    unittest.main()
