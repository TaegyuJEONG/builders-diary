"""Read-only adapter for Cursor's conversation-search SQLite index."""
from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any

from .base import SourceContent, SourceMetadata


class CursorAdapter:
    client_id = "cursor"

    def __init__(self, global_storage_root: str | Path):
        self.root = Path(global_storage_root).expanduser()
        self.database = self.root / "conversation-search.db"
        if not self.database.is_file():
            raise FileNotFoundError(f"Cursor conversation index not found: {self.database}")

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(f"file:{self.database.resolve()}?mode=ro", uri=True)

    def _rows(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT source, scope, id, title, branches, updated_at, is_archived, root_fingerprint, cache_fingerprint FROM conversations WHERE source = 'local' ORDER BY updated_at DESC, id").fetchall()
        keys = ("source", "scope", "id", "title", "branches", "updated_at", "is_archived", "root_fingerprint", "cache_fingerprint")
        return [dict(zip(keys, row)) for row in rows]

    def discover(self) -> list[SourceMetadata]:
        result = []
        for row in self._rows():
            source_id = str(row["id"])
            source_ref = f"cursor:{source_id}"
            safe = {key: row[key] for key in ("source", "scope", "id", "title", "updated_at", "root_fingerprint")}
            fingerprint = "sha256:" + hashlib.sha256(json.dumps(safe, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
            result.append(SourceMetadata(client=self.client_id, kind="chat", source_id=source_id, title=row["title"] or "", timestamp=str(row["updated_at"]) if row["updated_at"] is not None else None, artifact_hints=("conversation-index",), raw_locator=str(self.database), fingerprint=fingerprint, source_ref=source_ref, extra={"source": row["source"], "scope": row["scope"], "is_archived": bool(row["is_archived"])}))
        return result

    def read(self, source_id: str) -> SourceContent:
        row = next((row for row in self._rows() if str(row["id"]) == source_id), None)
        if row is None:
            raise ValueError(f"Unknown source: cursor:{source_id}")
        return SourceContent(source_id, row)
