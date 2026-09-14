"""Read-only adapter for a downloaded Claude Chat export directory."""
from __future__ import annotations

import hashlib
import json
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any

from .base import SourceContent, SourceMetadata

_EXPORT_CATEGORIES = {"conversations", "projects", "memories", "light_metadata"}
_VISIBLE = ("conversations", "projects", "memories")


def _category(path: Path) -> str | None:
    name = path.name.lower()
    return next((item for item in _EXPORT_CATEGORIES if name.startswith(item + "-") and name.endswith(".zip")), None)


def _json(archive: zipfile.ZipFile, name: str) -> Any:
    with archive.open(name) as source:
        return json.load(source)


def _range(items: list[dict[str, Any]], key: str) -> dict[str, str | None]:
    values = sorted(str(item.get(key) or "") for item in items if item.get(key))
    return {"first": values[0] if values else None, "last": values[-1] if values else None}


def _fingerprint(value: dict[str, Any]) -> str:
    safe = {key: value.get(key) for key in ("source_ref", "kind", "source_id", "title", "summary", "created_at", "updated_at", "message_count")}
    encoded = json.dumps(safe, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


class ClaudeChatExportAdapter:
    client_id = "claude"

    def __init__(self, export_dir: str | Path):
        self.export_dir = Path(export_dir).expanduser()
        if not self.export_dir.is_dir():
            raise FileNotFoundError(f"Export directory not found: {self.export_dir}")

    def _archives(self) -> dict[str, list[Path]]:
        archives: dict[str, list[Path]] = defaultdict(list)
        for path in self.export_dir.iterdir():
            if path.is_file() and (kind := _category(path)):
                archives[kind].append(path)
        return archives

    def legacy_index(self) -> dict[str, Any]:
        archives = self._archives()
        conversations: list[dict[str, Any]] = []
        projects: list[dict[str, Any]] = []
        memory_file_count = 0
        warnings: list[str] = []
        for path in sorted(archives.get("conversations", [])):
            try:
                with zipfile.ZipFile(path) as archive:
                    for name in archive.namelist():
                        if name.endswith("conversations.json"):
                            data = _json(archive, name)
                            if not isinstance(data, list):
                                warnings.append(f"{path.name}: conversations.json is not a list")
                                continue
                            conversations.extend({"source_id": row.get("uuid"), "title": row.get("name") or "", "summary": row.get("summary") or "", "created_at": row.get("created_at"), "updated_at": row.get("updated_at"), "message_count": len(row.get("chat_messages") or [])} for row in data if isinstance(row, dict))
            except (OSError, zipfile.BadZipFile, json.JSONDecodeError) as error:
                warnings.append(f"{path.name}: unreadable conversations export ({type(error).__name__})")
        for path in sorted(archives.get("projects", [])):
            try:
                with zipfile.ZipFile(path) as archive:
                    for name in archive.namelist():
                        if name.endswith(".json"):
                            row = _json(archive, name)
                            if isinstance(row, dict):
                                projects.append({"source_id": row.get("uuid"), "name": row.get("name") or "", "description": row.get("description") or "", "prompt_template": row.get("prompt_template") or "", "is_starter_project": bool(row.get("is_starter_project")), "created_at": row.get("created_at"), "updated_at": row.get("updated_at"), "doc_count": len(row.get("docs") or [])})
            except (OSError, zipfile.BadZipFile, json.JSONDecodeError) as error:
                warnings.append(f"{path.name}: unreadable projects export ({type(error).__name__})")
        for path in sorted(archives.get("memories", [])):
            try:
                with zipfile.ZipFile(path) as archive:
                    memory_file_count += sum(name.endswith(".json") for name in archive.namelist())
            except (OSError, zipfile.BadZipFile) as error:
                warnings.append(f"{path.name}: unreadable memories export ({type(error).__name__})")
        if archives.get("light_metadata"):
            warnings.append("light_metadata was detected and intentionally excluded from portfolio analysis")
        return {"schema_version": 1, "source": "claude_chat_export", "export_dir": str(self.export_dir), "archives": {kind: [path.name for path in paths] for kind, paths in sorted(archives.items()) if kind in _VISIBLE}, "conversation_count": len(conversations), "project_count": len(projects), "memory_file_count": memory_file_count, "conversation_date_range": _range(conversations, "created_at"), "conversations": conversations, "projects": projects, "warnings": warnings}

    def discover(self) -> list[SourceMetadata]:
        index = self.legacy_index()
        return [SourceMetadata(client="claude", kind="chat", source_id=str(row["source_id"]), title=row["title"], summary=row["summary"], timestamp=row["created_at"], artifact_hints=("conversation",), raw_locator=str(self.export_dir), source_ref=f"chat:{row['source_id']}", fingerprint=_fingerprint({**row, "kind": "chat", "source_ref": f"chat:{row['source_id']}"}), extra={"created_at": row["created_at"], "updated_at": row["updated_at"], "message_count": row["message_count"]}) for row in index["conversations"] if row.get("source_id")]

    def read(self, source_id: str) -> SourceContent:
        for path in sorted(self._archives().get("conversations", [])):
            archive_path = path.resolve()
            if self.export_dir.resolve() not in archive_path.parents:
                raise ValueError(f"Indexed path is outside allowed source root: {archive_path}")
            with zipfile.ZipFile(archive_path) as archive:
                for name in archive.namelist():
                    if name.endswith("conversations.json"):
                        rows = _json(archive, name)
                        row = next((item for item in rows if isinstance(item, dict) and item.get("uuid") == source_id), None)
                        if row is not None:
                            return SourceContent(source_id, row)
        raise FileNotFoundError(f"Chat source content not found: chat:{source_id}")
