"""Read-only adapter for Claude Code's explicit local projects root."""
from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from .base import SourceContent, SourceMetadata


def _safe(value: Any, limit: int = 500) -> str:
    if isinstance(value, str):
        return re.sub(r"\s+", " ", value).strip()[:limit]
    if isinstance(value, dict):
        for key in ("text", "content", "message"):
            if key in value:
                return _safe(value[key], limit)
    if isinstance(value, list):
        return _safe(" ".join(_safe(item, limit) for item in value), limit)
    return ""


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


def _range(items: list[dict[str, Any]], key: str) -> dict[str, str | None]:
    values = sorted(str(item.get(key) or "") for item in items if item.get(key))
    return {"first": values[0] if values else None, "last": values[-1] if values else None}


def _fingerprint(value: dict[str, Any]) -> str:
    safe = {key: value.get(key) for key in ("source_ref", "kind", "source_id", "title", "cwd", "created_at", "updated_at")}
    return "sha256:" + hashlib.sha256(json.dumps(safe, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


class ClaudeCodeAdapter:
    client_id = "claude"

    def __init__(self, config_dir: str | Path):
        self.config_dir = Path(config_dir).expanduser()
        self.projects_root = self.config_dir / "projects"
        if not self.projects_root.is_dir():
            raise FileNotFoundError(f"Claude Code projects directory not found: {self.projects_root}")

    def legacy_index(self) -> dict[str, Any]:
        sessions = []
        warnings = []
        for path in sorted(self.projects_root.glob("*/*.jsonl")):
            try:
                rows = _rows(path)
            except OSError as error:
                warnings.append(f"{path.name}: unreadable session ({type(error).__name__})")
                continue
            if not rows:
                continue
            cwd = next((row.get("cwd") for row in rows if row.get("cwd")), None)
            session_id = next((row.get("sessionId") for row in rows if row.get("sessionId")), path.stem)
            titles = [_safe(row.get("customTitle") or row.get("aiTitle")) for row in reversed(rows) if row.get("customTitle") or row.get("aiTitle")]
            prompts = [_safe(row.get("message") or row.get("content")) for row in rows if row.get("type") == "user"]
            timestamps = sorted(str(row.get("timestamp") or "") for row in rows if row.get("timestamp"))
            sessions.append({"source_id": session_id, "title": titles[0] if titles else "", "cwd": cwd, "first_prompt": next((item for item in prompts if item), ""), "last_prompt": next((item for item in reversed(prompts) if item), ""), "created_at": timestamps[0] if timestamps else None, "updated_at": timestamps[-1] if timestamps else None, "transcript_file": str(path), "project_store": path.parent.name})
        groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for session in sessions:
            groups[session.get("cwd") or session["project_store"]].append(session)
        workspaces = [{"source_id": workspace, "name": Path(workspace).name or workspace, "cwd": workspace, "session_count": len(group), "date_range": _range(group, "created_at")} for workspace, group in sorted(groups.items())]
        return {"schema_version": 1, "source": "claude_code_local", "config_dir": str(self.config_dir), "session_count": len(sessions), "workspace_count": len(workspaces), "sessions": sessions, "workspaces": workspaces, "warnings": warnings}

    def discover(self) -> list[SourceMetadata]:
        index = self.legacy_index()
        result = []
        for row in index["sessions"]:
            source_ref = f"code:{row['source_id']}"
            result.append(SourceMetadata(client="claude", kind="code", source_id=str(row["source_id"]), title=row["title"], summary=row["first_prompt"], timestamp=row["created_at"], workspace=row["cwd"], artifact_hints=("transcript",), raw_locator=row["transcript_file"], source_ref=source_ref, fingerprint=_fingerprint({**row, "kind": "code", "source_ref": source_ref}), extra={"created_at": row["created_at"], "updated_at": row["updated_at"], "first_prompt": row["first_prompt"], "last_prompt": row["last_prompt"], "transcript_file": row["transcript_file"], "project_store": row["project_store"]}))
        return result

    def read(self, source_id: str) -> SourceContent:
        match = next((row for row in self.legacy_index()["sessions"] if str(row["source_id"]) == source_id), None)
        if match is None:
            raise ValueError(f"Unknown source: code:{source_id}")
        transcript = Path(match["transcript_file"]).expanduser().resolve()
        root = self.projects_root.resolve()
        try:
            transcript.relative_to(root)
        except ValueError as error:
            raise ValueError(f"Indexed path is outside allowed source root: {transcript}") from error
        if not transcript.is_file():
            raise FileNotFoundError(f"Indexed source file not found: {transcript}")
        return SourceContent(source_id, _rows(transcript))
