from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from skill.scripts.source_dedup import deduplicate_sources, normalize_source
from skill.scripts.claude_import import prepare_import_run


class SourceDedupTests(unittest.TestCase):
    def test_normalized_fingerprint_uses_stable_identity_and_content_hash(self) -> None:
        source = {
            "client": "Cursor", "source_id": "abc", "title": " Fix auth ",
            "content": "User: Fix auth\nAssistant: Done",
        }
        normalized = normalize_source(source)
        self.assertEqual(normalized["source_ref"], "cursor:abc")
        self.assertTrue(normalized["content_hash"].startswith("sha256:"))
        self.assertTrue(normalized["fingerprint"].startswith("sha256:"))
        self.assertEqual(normalized["fingerprint"], normalize_source({**source, "client": "cursor"})["fingerprint"])

    def test_exact_duplicate_sources_collapse_to_first_stable_source(self) -> None:
        sources = [
            {"client": "claude", "source_id": "chat-1", "title": "Build it", "content": "same"},
            {"client": "cursor", "source_id": "cursor-9", "title": "Build it", "content": "same"},
        ]
        result = deduplicate_sources(sources)
        self.assertEqual(result["unique_sources"], ["claude:chat-1"])
        self.assertEqual(result["exact_duplicates"], [{"canonical_source_ref": "claude:chat-1", "duplicate_source_refs": ["cursor:cursor-9"]}])

    def test_semantic_similarity_is_candidate_only(self) -> None:
        result = deduplicate_sources([
            {"client": "claude", "source_id": "one", "title": "Build auth flow", "content": "Build the auth flow with sessions"},
            {"client": "codex", "source_id": "two", "title": "Build auth flow", "content": "Build the auth flow with tokens"},
        ])
        self.assertEqual(result["unique_sources"], ["claude:one", "codex:two"])
        self.assertEqual(len(result["merge_candidates"]), 1)
        self.assertEqual(result["merge_candidates"][0]["status"], "candidate")
        self.assertNotIn("merged_source_ref", result["merge_candidates"][0])

    def test_prepare_run_writes_dedup_report_and_excludes_exact_duplicates_from_candidates(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            export = root / "export"; export.mkdir()
            config = root / "claude" / "projects" / "-Users-demo-App"; config.mkdir(parents=True)
            import zipfile
            with zipfile.ZipFile(export / "conversations-001.zip", "w") as archive:
                archive.writestr("conversations.json", json.dumps([{
                    "uuid": "chat-1", "name": "Same source", "summary": "Same summary",
                    "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
                    "chat_messages": [],
                }]))
            (config / "session.jsonl").write_text(json.dumps({
                "type": "user", "sessionId": "chat-1", "cwd": "/Users/demo/App",
                "message": {"content": "Same summary"}, "timestamp": "2026-01-01T00:00:00Z",
            }) + "\n", encoding="utf-8")
            result = prepare_import_run(data_root=root / "data", export_dir=export, claude_config_dir=root / "claude")
            run_dir = Path(result["run_dir"])
            report = json.loads((run_dir / "dedup-report.json").read_text())
            self.assertIn("exact_duplicates", report)
            self.assertIn("merge_candidates", report)
            self.assertEqual(result["manifest"]["counts"]["dedup_exact_duplicates"], len(report["exact_duplicates"]))

    def test_proposal_ownership_uses_canonical_exact_duplicate_source(self) -> None:
        from skill.scripts.claude_import import propose_project
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); run = root / "imports" / "claude-20260101T000000Z-abcdef"; run.mkdir(parents=True)
            (run / "manifest.json").write_text(json.dumps({"id": run.name}), encoding="utf-8")
            (run / "source-index.json").write_text(json.dumps({"chat": {"conversations": [{"source_id": "one", "title": "One"}, {"source_id": "alias", "title": "Alias"}]}, "code": {"sessions": []}}), encoding="utf-8")
            (run / "project-candidates.json").write_text(json.dumps({"candidates": []}), encoding="utf-8")
            (run / "dedup-report.json").write_text(json.dumps({"canonical_by_ref": {"chat:alias": "chat:one"}}), encoding="utf-8")
            propose_project(data_root=root, run_id=run.name, name="First", summary="x", source_refs=["chat:one"])
            with self.assertRaisesRegex(ValueError, "already belongs"):
                propose_project(data_root=root, run_id=run.name, name="Second", summary="x", source_refs=["chat:alias"])


if __name__ == "__main__":
    unittest.main()
