"""Read-only adapter for Codex CLI's explicit sessions JSONL root."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from .base import SourceContent, SourceMetadata


def _rows(path: Path) -> list[dict[str, Any]]:
    result = []
    with path.open("r", encoding="utf-8", errors="replace") as source:
        for line in source:
            try:
                value = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                result.append(value)
    return result


class CodexAdapter:
    client_id = "codex"

    def __init__(self, codex_root: str | Path):
        self.root = Path(codex_root).expanduser()
        self.sessions_root = self.root / "sessions"
        if not self.sessions_root.is_dir():
            raise FileNotFoundError(f"Codex sessions directory not found: {self.sessions_root}")

    def _files(self) -> list[Path]:
        return sorted(self.sessions_root.glob("**/*.jsonl"))

    def _indexed(self) -> list[tuple[Path, list[dict[str, Any]], dict[str, Any]]]:
        result = []
        for path in self._files():
            rows = _rows(path)
            meta = next((row.get("payload", {}) for row in rows if row.get("type") == "session_meta" and isinstance(row.get("payload"), dict)), {})
            if rows:
                result.append((path, rows, meta))
        return result

    def discover(self) -> list[SourceMetadata]:
        result = []
        for path, rows, meta in self._indexed():
            source_id = str(meta.get("id") or meta.get("session_id") or path.stem.removeprefix("rollout-"))
            source_ref = f"codex:{source_id}"
            timestamps = [str(row["timestamp"]) for row in rows if row.get("timestamp")]
            prompt = next((str(row.get("payload", {}).get("item", {}).get("content", ""))[:500] for row in rows if isinstance(row.get("payload"), dict) and row.get("payload", {}).get("item", {}).get("type") == "UserMessage"), "")
            safe = {"source_ref": source_ref, "path": str(path), "cwd": meta.get("cwd"), "created_at": timestamps[0] if timestamps else None}
            fingerprint = "sha256:" + hashlib.sha256(json.dumps(safe, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
            result.append(SourceMetadata(client=self.client_id, kind="code", source_id=source_id, summary=prompt, timestamp=timestamps[0] if timestamps else None, workspace=meta.get("cwd"), artifact_hints=("session-jsonl",), raw_locator=str(path), fingerprint=fingerprint, source_ref=source_ref, extra={"updated_at": timestamps[-1] if timestamps else None, "session_file": str(path), "originator": meta.get("originator"), "cli_version": meta.get("cli_version"), "git_branch": meta.get("git", {}).get("branch") if isinstance(meta.get("git"), dict) else None}))
        return result

    def read(self, source_id: str) -> SourceContent:
        for path, rows, meta in self._indexed():
            candidate = str(meta.get("id") or meta.get("session_id") or path.stem.removeprefix("rollout-"))
            if candidate == source_id:
                return SourceContent(source_id, rows)
        raise ValueError(f"Unknown source: codex:{source_id}")
