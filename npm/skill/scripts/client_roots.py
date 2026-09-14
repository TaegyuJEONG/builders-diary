"""Validation and persistence model for explicitly approved client history roots."""
from __future__ import annotations
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1
DEFAULT_CLAUDE_ADAPTER_IDS = ["claude_chat_export", "claude_code"]
CLIENT_ADAPTER_IDS: dict[str, tuple[str, ...]] = {
    "claude": tuple(DEFAULT_CLAUDE_ADAPTER_IDS), "cursor": (), "codex": (),
    "antigravity": (), "hermes": (),
}

def validate_source_root(value: str | Path) -> Path:
    if not isinstance(value, (str, Path)) or "\x00" in str(value):
        raise ValueError("Source root must be an absolute path")
    path = Path(value).expanduser()
    if not path.is_absolute():
        raise ValueError("Source root must be an absolute path")
    resolved = path.resolve()
    if not resolved.exists() or not resolved.is_dir():
        raise ValueError(f"Source root must be an existing directory: {resolved}")
    return resolved

def validate_client_roots(raw: dict[str, Any] | None) -> dict[str, list[dict[str, str]]]:
    if raw is None: return {}
    if not isinstance(raw, dict): raise ValueError("Client roots must be an object")
    result: dict[str, list[dict[str, str]]] = {}
    for client_id, entries in raw.items():
        if client_id not in CLIENT_ADAPTER_IDS: raise ValueError(f"Unknown import client: {client_id}")
        if not isinstance(entries, list): raise ValueError(f"Roots for {client_id} must be a list")
        clean = []
        for entry in entries:
            if not isinstance(entry, dict): raise ValueError("Each source root must be an object")
            adapter_id = entry.get("adapter_id")
            if adapter_id not in set(CLIENT_ADAPTER_IDS[client_id]):
                raise ValueError(f"adapter id is not allowlisted for {client_id}: {adapter_id}")
            clean.append({"adapter_id": adapter_id, "path": str(validate_source_root(entry.get("path", "")))})
        result[client_id] = clean
    return result

def build_import_config(client_roots: dict[str, Any] | None = None) -> dict[str, Any]:
    roots_by_client = validate_client_roots(client_roots)
    source_roots = [{"client_id": c, **root} for c, roots in roots_by_client.items() for root in roots]
    enabled = list(dict.fromkeys(["claude", *roots_by_client.keys()]))
    clients = {"claude": {"enabled": True, "adapter_ids": list(DEFAULT_CLAUDE_ADAPTER_IDS), "roots": roots_by_client.get("claude", [])}}
    clients.update({c: {"enabled": c in enabled, "adapter_ids": list(ids), "roots": roots_by_client.get(c, [])} for c, ids in CLIENT_ADAPTER_IDS.items() if c != "claude"})
    return {"schema_version": SCHEMA_VERSION, "enabled_clients": enabled, "clients": clients, "source_roots": source_roots}
