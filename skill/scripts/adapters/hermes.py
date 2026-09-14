"""Read-only adapter for one Hermes profile's session SQLite database."""
from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .base import SourceContent, SourceMetadata


def _time(value: Any) -> str | None:
    if value is None: return None
    try: return datetime.fromtimestamp(float(value), timezone.utc).isoformat().replace("+00:00", "Z")
    except (TypeError, ValueError, OverflowError): return str(value)


class HermesAdapter:
    client_id = "hermes"

    def __init__(self, state_database: str | Path):
        self.database = Path(state_database).expanduser()
        if not self.database.is_file():
            raise FileNotFoundError(f"Hermes state database not found: {self.database}")

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(f"file:{self.database.resolve()}?mode=ro", uri=True)

    def _sessions(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            columns = [row[1] for row in conn.execute("PRAGMA table_info(sessions)")]
            wanted = [key for key in ("id", "source", "display_name", "title", "started_at", "ended_at", "message_count", "cwd", "git_branch", "archived", "hidden") if key in columns]
            return [dict(zip(wanted, row)) for row in conn.execute("SELECT " + ",".join(wanted) + " FROM sessions ORDER BY started_at DESC, id")]

    def discover(self) -> list[SourceMetadata]:
        result = []
        for row in self._sessions():
            source_id = str(row["id"]); source_ref = f"hermes:{source_id}"
            safe = {key: row.get(key) for key in ("id", "source", "title", "started_at", "ended_at", "cwd")}
            fingerprint = "sha256:" + hashlib.sha256(json.dumps(safe, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
            result.append(SourceMetadata(client=self.client_id, kind="chat", source_id=source_id, title=row.get("title") or row.get("display_name") or "", timestamp=_time(row.get("started_at")), workspace=row.get("cwd"), artifact_hints=("session-database",), raw_locator=str(self.database), fingerprint=fingerprint, source_ref=source_ref, extra={"updated_at": _time(row.get("ended_at")), "message_count": row.get("message_count"), "source": row.get("source"), "git_branch": row.get("git_branch")}))
        return result

    def read(self, source_id: str) -> SourceContent:
        if not any(str(row["id"]) == source_id for row in self._sessions()):
            raise ValueError(f"Unknown source: hermes:{source_id}")
        with self._connect() as conn:
            columns = [row[1] for row in conn.execute("PRAGMA table_info(messages)")]
            wanted = [key for key in ("id", "session_id", "role", "content", "tool_call_id", "tool_calls", "tool_name", "timestamp", "display_kind") if key in columns]
            rows = [dict(zip(wanted, row)) for row in conn.execute("SELECT " + ",".join(wanted) + " FROM messages WHERE session_id = ? ORDER BY id", (source_id,))]
        return SourceContent(source_id, rows)
