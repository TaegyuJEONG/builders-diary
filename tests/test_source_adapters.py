from __future__ import annotations

import json
import tempfile
import unittest
import zipfile
import sqlite3
from pathlib import Path

from skill.scripts.adapters.base import SourceContent, SourceMetadata, SourceAdapter
from skill.scripts.adapters.claude_chat_export import ClaudeChatExportAdapter
from skill.scripts.adapters.claude_code import ClaudeCodeAdapter
from skill.scripts.adapters.cursor import CursorAdapter
from skill.scripts.adapters.codex import CodexAdapter
from skill.scripts.adapters.hermes import HermesAdapter
from skill.scripts.adapters.unsupported import UnsupportedClientAdapter
from skill.scripts.claude_import import scan_claude_code_sessions, scan_export_directory, prepare_import_run


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

    def test_cursor_reads_confirmed_conversation_search_fixture(self) -> None:
        db = self.root / "cursor"; db.mkdir()
        conn = sqlite3.connect(db / "conversation-search.db")
        conn.execute("CREATE TABLE conversations (fts_rowid INTEGER PRIMARY KEY, source TEXT, scope TEXT, id TEXT, title TEXT, branches TEXT, updated_at INTEGER, is_archived INTEGER, root_fingerprint TEXT, cache_fingerprint TEXT)")
        conn.execute("INSERT INTO conversations VALUES (1,'local','','cursor-1','Fix auth','',1700000000000,0,NULL,NULL)")
        conn.commit(); conn.close()
        adapter = CursorAdapter(db)
        self.assertEqual(adapter.discover()[0].source_ref, "cursor:cursor-1")
        self.assertEqual(adapter.read("cursor-1").content["title"], "Fix auth")

    def test_codex_reads_confirmed_session_jsonl_fixture(self) -> None:
        root = self.root / "codex" / "sessions" / "2026" / "01" / "01"; root.mkdir(parents=True)
        path = root / "rollout-abc.jsonl"
        path.write_text("\n".join([
            json.dumps({"timestamp":"2026-01-01T00:00:00Z","ordinal":0,"type":"session_meta","payload":{"id":"codex-1","cwd":"/Users/demo/Project","originator":"Codex CLI"}}),
            json.dumps({"timestamp":"2026-01-01T00:01:00Z","ordinal":1,"type":"event_msg","payload":{"type":"task_started"}}),
        ]) + "\n", encoding="utf-8")
        adapter = CodexAdapter(self.root / "codex")
        self.assertEqual(adapter.discover()[0].source_id, "codex-1")
        self.assertEqual(adapter.discover()[0].workspace, "/Users/demo/Project")
        self.assertEqual(len(adapter.read("codex-1").content), 2)

    def test_hermes_reads_confirmed_state_db_fixture(self) -> None:
        db = self.root / "state.db"
        conn = sqlite3.connect(db)
        conn.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, source TEXT, display_name TEXT, title TEXT, started_at REAL, ended_at REAL, message_count INTEGER, cwd TEXT, git_branch TEXT, archived INTEGER, hidden INTEGER)")
        conn.execute("CREATE TABLE messages (id INTEGER PRIMARY KEY, session_id TEXT, role TEXT, content TEXT, timestamp REAL, tool_name TEXT)")
        conn.execute("INSERT INTO sessions VALUES ('hermes-1','desktop','Diary','Build feature',1700000000,1700000010,1,'/Users/demo/Project','main',0,0)")
        conn.execute("INSERT INTO messages VALUES (1,'hermes-1','user','Capture this',1700000001,NULL)")
        conn.commit(); conn.close()
        adapter = HermesAdapter(db)
        self.assertEqual(adapter.discover()[0].source_ref, "hermes:hermes-1")
        self.assertEqual(adapter.read("hermes-1").content[0]["content"], "Capture this")

    def test_unsupported_client_never_scans_implicit_paths(self) -> None:
        result = UnsupportedClientAdapter("antigravity").discover_result()
        self.assertEqual(result["status"], "blocked")
        self.assertIn("fixture", result["reason"].lower())
        self.assertEqual(UnsupportedClientAdapter("antigravity").discover(), [])

    def test_selected_cursor_adapter_reaches_normalized_prepare_source_index(self) -> None:
        cursor = self.root / "cursor"; cursor.mkdir()
        conn = sqlite3.connect(cursor / "conversation-search.db")
        conn.execute("CREATE TABLE conversations (fts_rowid INTEGER PRIMARY KEY, source TEXT, scope TEXT, id TEXT, title TEXT, branches TEXT, updated_at INTEGER, is_archived INTEGER, root_fingerprint TEXT, cache_fingerprint TEXT)")
        conn.execute("INSERT INTO conversations VALUES (1,'local','','cursor-indexed','Indexed work','',1700000000000,0,NULL,NULL)")
        conn.commit(); conn.close()
        data = self.root / "data"; data.mkdir()
        result = prepare_import_run(data_root=data, export_dir=self.export, claude_config_dir=self.config, selected_clients={"cursor": str(cursor)})
        index = json.loads((Path(result["run_dir"]) / "source-index.json").read_text())
        self.assertEqual(index["clients"]["cursor"]["sources"][0]["source_id"], "cursor-indexed")
        self.assertNotIn("content", json.dumps(index["clients"]["cursor"]["sources"]))


if __name__ == "__main__":
    unittest.main()
