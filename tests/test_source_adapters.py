from __future__ import annotations

import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from skill.scripts.adapters.base import SourceContent, SourceMetadata, SourceAdapter
from skill.scripts.adapters.claude_chat_export import ClaudeChatExportAdapter
from skill.scripts.adapters.claude_code import ClaudeCodeAdapter
from skill.scripts.claude_import import scan_claude_code_sessions, scan_export_directory


class SourceAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.export = self.root / "export"
        self.export.mkdir()
        self.config = self.root / "claude"
        sessions = self.config / "projects" / "-Users-demo-Project"
        sessions.mkdir(parents=True)
        self.chat_row = {
            "uuid": "chat-1", "name": "A chat", "summary": "A summary",
            "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-02T00:00:00Z",
            "chat_messages": [{"sender": "human", "text": "private"}],
        }
        with zipfile.ZipFile(self.export / "conversations-001.zip", "w") as archive:
            archive.writestr("conversations.json", json.dumps([self.chat_row]))
        with zipfile.ZipFile(self.export / "light_metadata-001.zip", "w") as archive:
            archive.writestr("users.json", json.dumps({"email": "private@example.com"}))
        self.transcript = sessions / "session.jsonl"
        self.transcript.write_text("\n".join([
            json.dumps({"type": "user", "sessionId": "code-1", "cwd": "/Users/demo/Project", "message": {"content": "Build it"}, "timestamp": "2026-02-01T00:00:00Z"}),
            json.dumps({"type": "assistant", "sessionId": "code-1", "cwd": "/Users/demo/Project", "message": {"content": "Done"}, "timestamp": "2026-02-01T00:01:00Z"}),
        ]) + "\n", encoding="utf-8")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_adapters_implement_normalized_interface(self) -> None:
        self.assertIsInstance(ClaudeChatExportAdapter(self.export), SourceAdapter)
        self.assertIsInstance(ClaudeCodeAdapter(self.config), SourceAdapter)

    def test_chat_discovery_has_normalized_metadata_and_no_light_metadata(self) -> None:
        sources = ClaudeChatExportAdapter(self.export).discover()
        self.assertEqual([source.source_id for source in sources], ["chat-1"])
        source = sources[0]
        self.assertEqual(source.client, "claude")
        self.assertEqual(source.kind, "chat")
        self.assertEqual(source.source_ref, "chat:chat-1")
        self.assertEqual(source.title, "A chat")
        self.assertNotIn("light_metadata", json.dumps([item.to_dict() for item in sources]))
        self.assertNotIn("chat_messages", source.to_dict())

    def test_code_discovery_has_stable_source_id_and_skips_subagents(self) -> None:
        sources = ClaudeCodeAdapter(self.config).discover()
        self.assertEqual([source.source_id for source in sources], ["code-1"])
        self.assertEqual(sources[0].source_ref, "code:code-1")
        self.assertEqual(sources[0].workspace, "/Users/demo/Project")

    def test_adapters_preserve_legacy_discovery_shapes(self) -> None:
        self.assertEqual(ClaudeChatExportAdapter(self.export).legacy_index(), scan_export_directory(self.export))
        self.assertEqual(ClaudeCodeAdapter(self.config).legacy_index(), scan_claude_code_sessions(self.config))

    def test_read_returns_selected_source_content(self) -> None:
        chat = ClaudeChatExportAdapter(self.export).read("chat-1")
        code = ClaudeCodeAdapter(self.config).read("code-1")
        self.assertIsInstance(chat, SourceContent)
        self.assertEqual(chat.content["chat_messages"][0]["text"], "private")
        self.assertTrue(any(row["type"] == "assistant" for row in code.content))

    def test_read_enforces_source_root_boundaries(self) -> None:
        outside = self.root / "outside.jsonl"
        outside.write_text("{}\n", encoding="utf-8")
        self.transcript.unlink()
        self.transcript.symlink_to(outside)
        with self.assertRaises(ValueError):
            ClaudeCodeAdapter(self.config).read("code-1")


if __name__ == "__main__":
    unittest.main()
