"""Safe, selected-only discovery of verified local client locations."""
from __future__ import annotations

from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1
DEFAULT_CLAUDE_ADAPTER_IDS = ["claude_chat_export", "claude_code"]
CLIENT_ADAPTER_IDS: dict[str, tuple[str, ...]] = {
    "claude": tuple(DEFAULT_CLAUDE_ADAPTER_IDS),
    # Only clients with inspected, fixture-backed formats are allowlisted.
    "cursor": ("cursor",),
    "codex": ("codex",),
    "antigravity": (),
    "hermes": ("hermes",),
}


def discover_default_roots(selected_clients: list[str], *, home: str | Path | None = None, hermes_profile: str | None = None) -> dict[str, dict[str, str]]:
    """Check only known paths for the explicitly selected clients.

    This performs existence/readability checks only; adapters do not read source
    content until the caller starts an import.
    """
    base = Path(home).expanduser() if home is not None else Path.home()
    result: dict[str, dict[str, str]] = {}
    for client_id in selected_clients:
        if client_id == "cursor":
            root = base / "Library/Application Support/Cursor/User/globalStorage"
            found = (root / "conversation-search.db").is_file() and root.is_dir() and root.stat()
            result[client_id] = {"status": "found" if found else "not_found", "path": str(root)}
        elif client_id == "codex":
            root = base / ".codex"
            found = (root / "sessions").is_dir() and root.stat()
            result[client_id] = {"status": "found" if found else "not_found", "path": str(root)}
        elif client_id == "hermes":
            profiles = base / ".hermes" / "profiles"
            candidates = [profiles / hermes_profile / "state.db"] if hermes_profile else sorted(profiles.glob("*/state.db"))
            database = next((path for path in candidates if path.is_file()), None)
            result[client_id] = {"status": "found" if database else "not_found", "path": str(database or (profiles / (hermes_profile or "<profile>") / "state.db"))}
        elif client_id == "claude":
            result[client_id] = {"status": "found", "path": str(base / ".claude")}
        else:
            result[client_id] = {"status": "blocked", "reason": "This source is not supported."}
    return result


def validate_source_root(value: str | Path) -> Path:
    """Return a canonical root, rejecting relative/missing/non-directory paths."""
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
    """Validate client -> explicit root entries and preserve no implicit defaults."""
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise ValueError("Client roots must be an object")
    result: dict[str, list[dict[str, str]]] = {}
    for client_id, entries in raw.items():
        if client_id not in CLIENT_ADAPTER_IDS:
            raise ValueError(f"Unknown import client: {client_id}")
        if not isinstance(entries, list):
            raise ValueError(f"Roots for {client_id} must be a list")
        allowed = set(CLIENT_ADAPTER_IDS[client_id])
        clean: list[dict[str, str]] = []
        for entry in entries:
            if not isinstance(entry, dict):
                raise ValueError("Each source root must be an object")
            adapter_id = entry.get("adapter_id")
            if adapter_id not in allowed:
                raise ValueError(f"adapter id is not allowlisted for {client_id}: {adapter_id}")
            root = validate_source_root(entry.get("path", ""))
            clean.append({"adapter_id": adapter_id, "path": str(root)})
        result[client_id] = clean
    return result


def build_import_config(client_roots: dict[str, Any] | None = None) -> dict[str, Any]:
    roots_by_client = validate_client_roots(client_roots)
    source_roots = [
        {"client_id": client_id, **root}
        for client_id, roots in roots_by_client.items()
        for root in roots
    ]
    enabled = ["claude"]
    for client_id in roots_by_client:
        if client_id not in enabled:
            enabled.append(client_id)
    return {
        "schema_version": SCHEMA_VERSION,
        "enabled_clients": enabled,
        "clients": {
            "claude": {"enabled": True, "adapter_ids": list(DEFAULT_CLAUDE_ADAPTER_IDS), "roots": roots_by_client.get("claude", [])},
            **{
                client_id: {"enabled": client_id in enabled, "adapter_ids": list(ids), "roots": roots_by_client.get(client_id, [])}
                for client_id, ids in CLIENT_ADAPTER_IDS.items() if client_id != "claude"
            },
        },
        "source_roots": source_roots,
    }
