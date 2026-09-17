#!/usr/bin/env python3
"""Local, read-only Claude import preparation for Builder's Diary.

This helper implements the honest project-first bulk contract: project_selection
precedes source_task_curation, and no task is fabricated without source evidence.
- Claude Chat export ZIPs contribute title/summary/project metadata only.
- Claude Code contributes every main local session's metadata.
- Source files are never extracted in place, changed, or uploaded.
- Import state is written only below the selected Builder's Diary data root.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import re
import sqlite3
import subprocess
import sys
import tempfile
import time
import uuid
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

try:
    from .action_protocol import create_result, read_action, write_json_atomic
    from .source_dedup import deduplicate_sources, normalize_source
except ImportError:  # direct execution from the installed skill directory
    try:
        from action_protocol import create_result, read_action, write_json_atomic
        from source_dedup import deduplicate_sources, normalize_source
    except ImportError:  # older installs lack the new shared module; non-action commands still work
        def normalize_source(source: dict[str, Any]) -> dict[str, Any]:
            """Compatibility fingerprint for an older install before helper sync."""
            source_ref = str(source.get("source_ref") or f"{source.get('kind', 'source')}:{source.get('source_id', '')}")
            safe = {key: source.get(key) for key in ("title", "summary", "first_prompt", "created_at", "updated_at", "message_count")}
            content_hash = "sha256:" + hashlib.sha256(json.dumps(safe, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
            return {"source_ref": source_ref, "content_hash": content_hash, "fingerprint": content_hash}

        def deduplicate_sources(sources: list[dict[str, Any]]) -> dict[str, Any]:
            refs = [str(source.get("source_ref") or f"{source.get('kind', 'source')}:{source.get('source_id', '')}") for source in sources]
            return {"schema_version": 1, "unique_sources": refs, "canonical_by_ref": {ref: ref for ref in refs}, "exact_duplicates": [], "merge_candidates": []}

        def write_json_atomic(path: Path, value: Any) -> None:
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
            temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            temporary.replace(path)

        def read_action(*args: Any, **kwargs: Any) -> Any:
            raise RuntimeError("action_protocol.py is required to apply web actions; reinstall the skill")

        def create_result(*args: Any, **kwargs: Any) -> Any:
            raise RuntimeError("action_protocol.py is required to apply web actions; reinstall the skill")

SCHEMA_VERSION = 1
TOOL_CATEGORIES = [
    "Programming languages", "MCP servers", "Skills", "Coding agents",
    "AI models", "AI frameworks", "Apps/platforms", "Other",
]
EXPORT_CATEGORIES = {"conversations", "projects", "memories", "light_metadata"}
VISIBLE_DOWNLOAD_CATEGORIES = ("conversations", "projects", "memories")
WEB_ACTIONS = {
    "project-confirm": "project.confirm",
    "project-enrich": "project.enrich",
    "project-merge": "project.merge",
    "project-split": "project.split",
    "task-approve": "task.approve",
    "task-drop": "task.drop",
    "task-merge": "task.merge",
    "task-split": "task.split",
}
TASK_ACTION_FIELDS = {
    "project", "goal", "stage", "title", "date", "activity", "purpose",
    "tools", "tool_categories", "mindset", "body", "evidence", "highlight", "proposal_id",
}
TASK_EVIDENCE_FIELDS = {"candidate_id", "kind", "type", "label", "url", "meta", "detail", "quote", "visibility", "verified"}
TASK_HIGHLIGHT_FIELDS = {"ai", "builder", "why"}
TASK_SPLIT_FIELDS = {"title", "body", "body_md", "project", "project_slug", "project_id", "goal", "goal_slug", "goal_id", "section", "date", "purpose", "activities", "activity", "tools", "tool_categories", "mindset", "evidence", "source_refs"}


def tooling_from_source_metadata(source: dict[str, Any]) -> dict[str, Any]:
    """Read observed tooling metadata only; never infer tools from topic text."""
    save_record = _import_save_record()
    raw = source.get("tooling_metadata", {}) if isinstance(source, dict) else {}
    return save_record.normalize_tooling_metadata(raw)


def _json_from_zip(archive: zipfile.ZipFile, name: str) -> Any:
    with archive.open(name) as source:
        return json.load(source)


def _zip_category(path: Path) -> str | None:
    name = path.name.lower()
    for category in EXPORT_CATEGORIES:
        if name.startswith(f"{category}-") and name.endswith(".zip"):
            return category
    return None


def _import_save_record() -> Any:
    """Load the daily skill's save_record module from wherever it was installed.

    The two skills are installed side by side, so when this file is executed as a
    script only its own folder (…/builders-diary-import/scripts) lands on sys.path
    and a bare ``import save_record`` cannot see the daily skill's
    …/builders-diary/scripts/save_record.py. In the repo both files sit together in
    skill/scripts/, which is why running from the repo never exposed this.
    """
    try:
        from . import save_record  # imported as part of the skill package
        return save_record
    except ImportError:
        pass

    import importlib.util

    for directory in (
        Path(__file__).resolve().parent,                                     # repo layout
        Path(__file__).resolve().parents[2] / "builders-diary" / "scripts",   # installed sibling
    ):
        module_path = directory / "save_record.py"
        if not module_path.is_file():
            continue
        spec = importlib.util.spec_from_file_location("save_record", module_path)
        if spec is None or spec.loader is None:
            continue
        module = importlib.util.module_from_spec(spec)
        sys.modules.setdefault("save_record", module)
        spec.loader.exec_module(module)
        return module

    raise ModuleNotFoundError(
        "save_record.py was not found next to this script or in the sibling "
        "builders-diary skill. Reinstall with: "
        "npx --yes builders-diary@latest install --tools claude"
    )


def _safe_text(value: Any, limit: int = 500) -> str:
    if isinstance(value, str):
        return re.sub(r"\s+", " ", value).strip()[:limit]
    if isinstance(value, list):
        return _safe_text(" ".join(_safe_text(item, limit) for item in value), limit)
    if isinstance(value, dict):
        for key in ("text", "content", "message"):
            if key in value:
                return _safe_text(value[key], limit)
    return ""


def _write_json(path: Path, value: Any) -> None:
    """Atomically replace a private import state JSON file."""
    write_json_atomic(path, value)


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _source_fingerprint(source: dict[str, Any]) -> str:
    """Stable local fingerprint of safe source metadata, never raw transcript text."""
    return normalize_source(source)["fingerprint"]


def _load_source_ledger(root: Path) -> dict[str, Any]:
    path = root / "imports" / "source-ledger.json"
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        value = {}
    if not isinstance(value, dict):
        value = {}
    sources = value.get("sources")
    return {
        "schema_version": 1,
        "sources": sources if isinstance(sources, dict) else {},
    }


def _append_run_event(run_dir: Path, event: str, **details: Any) -> None:
    """Append an auditable state transition without storing raw source content."""
    payload = {"at": _utc_now(), "event": event, **details}
    path = run_dir / "events.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as target:
        target.write(json.dumps(payload, ensure_ascii=False, sort_keys=True) + "\n")


def _classify_sources(root: Path, catalog: dict[str, dict[str, Any]]) -> tuple[dict[str, str], dict[str, Any]]:
    """Update the source inventory and label each source new, changed, or unchanged."""
    ledger = _load_source_ledger(root)
    sources = ledger["sources"]
    classifications: dict[str, str] = {}
    now = _utc_now()
    for source_ref, source in catalog.items():
        fingerprint = _source_fingerprint(source)
        previous: Any = sources.get(source_ref)
        if not isinstance(previous, dict):
            state = "new"
            previous = {"first_seen_at": now, "status": "unseen"}
        elif previous.get("content_hash") == fingerprint:
            state = "pending" if previous.get("status") in {"unseen", "postponed"} else "unchanged"
        else:
            state = "changed"
        previous.update({
            "source_client": "claude",
            "source_surface": source.get("kind"),
            "source_id": source.get("source_id"),
            "content_hash": fingerprint,
            "updated_at": source.get("updated_at"),
            "last_seen_at": now,
        })
        sources[source_ref] = previous
        classifications[source_ref] = state
    _write_json(root / "imports" / "source-ledger.json", ledger)
    return classifications, ledger


def _date_range(items: list[dict[str, Any]], key: str) -> dict[str, str | None]:
    values = sorted(str(item.get(key) or "") for item in items if item.get(key))
    return {"first": values[0] if values else None, "last": values[-1] if values else None}


def scan_export_directory(export_dir: str | Path) -> dict[str, Any]:
    """Read supported Claude export ZIP metadata without exposing raw chats."""
    try:
        from .adapters.claude_chat_export import ClaudeChatExportAdapter
    except ImportError:
        try:
            from adapters.claude_chat_export import ClaudeChatExportAdapter
        except ImportError:
            ClaudeChatExportAdapter = None
    if ClaudeChatExportAdapter is not None:
        return ClaudeChatExportAdapter(export_dir).legacy_index()

    # Kept below as historical reference for the legacy shape; the adapter above
    # is the sole implementation used by callers.
    directory = Path(export_dir).expanduser()
    if not directory.is_dir():
        raise FileNotFoundError(f"Export directory not found: {directory}")

    archives: dict[str, list[Path]] = defaultdict(list)
    for path in directory.iterdir():
        if path.is_file():
            category = _zip_category(path)
            if category:
                archives[category].append(path)

    conversations: list[dict[str, Any]] = []
    projects: list[dict[str, Any]] = []
    memory_file_count = 0
    warnings: list[str] = []

    for path in sorted(archives.get("conversations", [])):
        try:
            with zipfile.ZipFile(path) as archive:
                for name in archive.namelist():
                    if name.endswith("conversations.json"):
                        data = _json_from_zip(archive, name)
                        if not isinstance(data, list):
                            warnings.append(f"{path.name}: conversations.json is not a list")
                            continue
                        for row in data:
                            if not isinstance(row, dict):
                                continue
                            conversations.append(
                                {
                                    "source_id": row.get("uuid"),
                                    "title": row.get("name") or "",
                                    "summary": row.get("summary") or "",
                                    "created_at": row.get("created_at"),
                                    "updated_at": row.get("updated_at"),
                                    "message_count": len(row.get("chat_messages") or []),
                                }
                            )
        except (OSError, zipfile.BadZipFile, json.JSONDecodeError) as error:
            warnings.append(f"{path.name}: unreadable conversations export ({type(error).__name__})")

    for path in sorted(archives.get("projects", [])):
        try:
            with zipfile.ZipFile(path) as archive:
                for name in archive.namelist():
                    if not name.endswith(".json"):
                        continue
                    row = _json_from_zip(archive, name)
                    if not isinstance(row, dict):
                        continue
                    projects.append(
                        {
                            "source_id": row.get("uuid"),
                            "name": row.get("name") or "",
                            "description": row.get("description") or "",
                            "prompt_template": row.get("prompt_template") or "",
                            "is_starter_project": bool(row.get("is_starter_project")),
                            "created_at": row.get("created_at"),
                            "updated_at": row.get("updated_at"),
                            "doc_count": len(row.get("docs") or []),
                        }
                    )
        except (OSError, zipfile.BadZipFile, json.JSONDecodeError) as error:
            warnings.append(f"{path.name}: unreadable projects export ({type(error).__name__})")

    for path in sorted(archives.get("memories", [])):
        try:
            with zipfile.ZipFile(path) as archive:
                memory_file_count += sum(1 for name in archive.namelist() if name.endswith(".json"))
        except (OSError, zipfile.BadZipFile) as error:
            warnings.append(f"{path.name}: unreadable memories export ({type(error).__name__})")

    if archives.get("light_metadata"):
        warnings.append("light_metadata was detected and intentionally excluded from portfolio analysis")

    return {
        "schema_version": SCHEMA_VERSION,
        "source": "claude_chat_export",
        "export_dir": str(directory),
        "archives": {
            category: [path.name for path in paths]
            for category, paths in sorted(archives.items())
            if category in VISIBLE_DOWNLOAD_CATEGORIES
        },
        "conversation_count": len(conversations),
        "project_count": len(projects),
        "memory_file_count": memory_file_count,
        "conversation_date_range": _date_range(conversations, "created_at"),
        "conversations": conversations,
        "projects": projects,
        "warnings": warnings,
    }


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8", errors="replace") as source:
        for line in source:
            try:
                value = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                rows.append(value)
    return rows


def scan_claude_code_sessions(config_dir: str | Path) -> dict[str, Any]:
    """Read every main Claude Code transcript; never scan subagent folders."""
    try:
        from .adapters.claude_code import ClaudeCodeAdapter
    except ImportError:
        try:
            from adapters.claude_code import ClaudeCodeAdapter
        except ImportError:
            ClaudeCodeAdapter = None
    if ClaudeCodeAdapter is not None:
        return ClaudeCodeAdapter(config_dir).legacy_index()

    # Kept below as historical reference for the legacy shape; the adapter above
    # is the sole implementation used by callers.
    config = Path(config_dir).expanduser()
    projects_root = config / "projects"
    if not projects_root.is_dir():
        raise FileNotFoundError(f"Claude Code projects directory not found: {projects_root}")

    sessions: list[dict[str, Any]] = []
    warnings: list[str] = []
    for path in sorted(projects_root.glob("*/*.jsonl")):
        try:
            rows = _read_jsonl(path)
        except OSError as error:
            warnings.append(f"{path.name}: unreadable session ({type(error).__name__})")
            continue
        if not rows:
            continue

        cwd = next((row.get("cwd") for row in rows if row.get("cwd")), None)
        session_id = next((row.get("sessionId") for row in rows if row.get("sessionId")), path.stem)
        title = next(
            (
                _safe_text(row.get("customTitle") or row.get("aiTitle"))
                for row in reversed(rows)
                if row.get("customTitle") or row.get("aiTitle")
            ),
            "",
        )
        user_prompts = [
            _safe_text(row.get("message") or row.get("content"))
            for row in rows
            if row.get("type") == "user"
        ]
        timestamps = sorted(str(row.get("timestamp") or "") for row in rows if row.get("timestamp"))
        sessions.append(
            {
                "source_id": session_id,
                "title": title,
                "cwd": cwd,
                "first_prompt": next((prompt for prompt in user_prompts if prompt), ""),
                "last_prompt": next((prompt for prompt in reversed(user_prompts) if prompt), ""),
                "created_at": timestamps[0] if timestamps else None,
                "updated_at": timestamps[-1] if timestamps else None,
                "transcript_file": str(path),
                "project_store": path.parent.name,
            }
        )

    workspace_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for session in sessions:
        workspace_groups[session.get("cwd") or session["project_store"]].append(session)

    workspaces = [
        {
            "source_id": workspace,
            "name": Path(workspace).name or workspace,
            "cwd": workspace,
            "session_count": len(group),
            "date_range": _date_range(group, "created_at"),
        }
        for workspace, group in sorted(workspace_groups.items())
    ]
    return {
        "schema_version": SCHEMA_VERSION,
        "source": "claude_code_local",
        "config_dir": str(config),
        "session_count": len(sessions),
        "workspace_count": len(workspaces),
        "sessions": sessions,
        "workspaces": workspaces,
        "warnings": warnings,
    }


def _candidate_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def _project_candidates(
    chat_index: dict[str, Any], code_index: dict[str, Any], allowed_source_refs: set[str] | None = None
) -> dict[str, Any]:
    candidates: list[dict[str, Any]] = []
    for project in chat_index.get("projects", []):
        name = project.get("name") or "Untitled Claude Project"
        candidates.append(
            {
                "id": f"chat-project:{project.get('source_id') or _candidate_key(name)}",
                "name": name,
                "source": "claude_chat_project",
                "source_ids": [project.get("source_id")],
                # Claude Chat exports carry no conversation→project link, so this stays
                # empty until the agent assigns conversations (assign-sources).
                "source_refs": [],
                "description": project.get("description") or "",
                "prompt_template": project.get("prompt_template") or "",
                "is_starter_project": bool(project.get("is_starter_project")),
                "doc_count": project.get("doc_count") or 0,
                "summary": "",
                "session_count": None,
                "status": "proposed",
            }
        )
    sessions_by_workspace: dict[str, list[str]] = defaultdict(list)
    for session in code_index.get("sessions", []):
        workspace = session.get("cwd") or session.get("project_store")
        if workspace and session.get("source_id"):
            sessions_by_workspace[str(workspace)].append(f"code:{session['source_id']}")
    for workspace in code_index.get("workspaces", []):
        name = workspace.get("name") or "Untitled Claude Code workspace"
        source_refs = list(dict.fromkeys(sessions_by_workspace.get(str(workspace.get("cwd")), [])))
        if allowed_source_refs is not None:
            source_refs = [source_ref for source_ref in source_refs if source_ref in allowed_source_refs]
        if not source_refs:
            continue
        candidates.append(
            {
                "id": f"code-workspace:{_candidate_key(workspace.get('cwd') or name)}",
                "name": name,
                "source": "claude_code_workspace",
                "source_ids": [workspace.get("source_id")],
                "source_refs": source_refs,
                "description": "",
                "summary": "",
                "session_count": workspace.get("session_count"),
                "status": "proposed",
            }
        )
    return {"schema_version": SCHEMA_VERSION, "candidates": candidates}


def prepare_import_run(
    *,
    data_root: str | Path,
    export_dir: str | Path,
    claude_config_dir: str | Path,
    selected_clients: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Build a private, resumable import index below data_root/imports only."""
    root = Path(data_root).expanduser()
    chat_index = scan_export_directory(export_dir)
    code_index = scan_claude_code_sessions(claude_config_dir)
    selected_clients = selected_clients or {}
    client_index: dict[str, dict[str, Any]] = {}
    adapter_classes: dict[str, Any] = {}
    if selected_clients:
        try:
            from .adapters.cursor import CursorAdapter
            from .adapters.codex import CodexAdapter
            from .adapters.hermes import HermesAdapter
        except ImportError:
            from adapters.cursor import CursorAdapter
            from adapters.codex import CodexAdapter
            from adapters.hermes import HermesAdapter
        adapter_classes = {"cursor": CursorAdapter, "codex": CodexAdapter, "hermes": HermesAdapter}
    for client_id, client_root in selected_clients.items():
        adapter_class = adapter_classes.get(client_id)
        if adapter_class is None:
            client_index[client_id] = {"status": "blocked", "sources": [], "reason": "This source is not supported."}
            continue
        try:
            client_index[client_id] = {"status": "found", "sources": [source.to_dict() for source in adapter_class(client_root).discover()]}
        except (OSError, ValueError, sqlite3.Error) as error:
            client_index[client_id] = {"status": "not_found", "sources": [], "reason": str(error)}
    source_index = {"chat": chat_index, "code": code_index, "clients": client_index}
    catalog = _source_catalog(source_index)
    classifications, _ = _classify_sources(root, catalog)
    dedup_report = deduplicate_sources(list(catalog.values()))
    canonical_refs = set(dedup_report["unique_sources"])

    # Resume support: surface projects already in the portfolio so the skill can
    # skip re-proposing them and continue where a previous run left off.
    existing_projects = _import_save_record().list_projects(str(root))

    run_id = f"claude-{dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:6]}"
    run_dir = root / "imports" / run_id
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "id": run_id,
        "source": "claude",
        "status": "project_selection",
        "phase": "project_first",
        "pause_supported": False,
        "project_progress": [],
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "privacy": {
            "light_metadata_included": False,
            "source_files_modified": False,
            "raw_transcripts_sent_to_model": False,
        },
        "counts": {
            "chat_conversations": chat_index["conversation_count"],
            "chat_projects": chat_index["project_count"],
            "code_sessions": code_index["session_count"],
            "code_workspaces": code_index["workspace_count"],
            "new_sources": sum(1 for state in classifications.values() if state == "new"),
            "changed_sources": sum(1 for state in classifications.values() if state == "changed"),
            "unchanged_sources": sum(1 for state in classifications.values() if state == "unchanged"),
            "pending_sources": sum(1 for state in classifications.values() if state == "pending"),
            "dedup_exact_duplicates": len(dedup_report["exact_duplicates"]),
            "dedup_merge_candidates": len(dedup_report["merge_candidates"]),
        },
        "existing_projects": existing_projects,
        "warnings": [*chat_index["warnings"], *code_index["warnings"]],
    }
    _write_json(run_dir / "manifest.json", manifest)
    _write_json(run_dir / "source-index.json", source_index)
    _write_json(run_dir / "source-classification.json", {"sources": classifications})
    _write_json(run_dir / "dedup-report.json", dedup_report)
    _write_json(run_dir / "project-candidates.json", _project_candidates(
        chat_index,
        code_index,
        {source_ref for source_ref, state in classifications.items() if state in {"new", "changed", "pending"} and source_ref in canonical_refs},
    ))
    _append_run_event(run_dir, "run_prepared", counts=manifest["counts"])
    return {"run_id": run_id, "run_dir": str(run_dir), "manifest": manifest}


def _load_run_manifest(data_root: str | Path, run_id: str) -> tuple[Path, dict[str, Any]]:
    if not re.fullmatch(r"claude-\d{8}T\d{6}Z-[0-9a-f]{6}", run_id):
        raise ValueError(f"Invalid import run id: {run_id}")
    imports_root = (Path(data_root).expanduser().resolve() / "imports").resolve()
    run_dir = (imports_root / run_id).resolve()
    try:
        run_dir.relative_to(imports_root)
    except ValueError as error:
        raise ValueError(f"Import run directory is outside imports root: {run_dir}") from error
    manifest_path = run_dir / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise FileNotFoundError(f"Import run not found: {run_id}") from error
    return run_dir, manifest


def list_import_runs(*, data_root: str | Path) -> list[dict[str, Any]]:
    """List resumable import runs without exposing private source indexes or transcripts."""
    imports_root = Path(data_root).expanduser() / "imports"
    if not imports_root.is_dir():
        return []
    runs: list[dict[str, Any]] = []
    for run_dir in imports_root.iterdir():
        if not run_dir.is_dir() or run_dir.name.startswith("."):
            continue
        try:
            manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(manifest, dict) or not isinstance(manifest.get("id"), str):
            continue
        runs.append({
            "id": manifest["id"],
            "source": manifest.get("source", "claude"),
            "status": manifest.get("status", "unknown"),
            "created_at": manifest.get("created_at"),
            "updated_at": manifest.get("updated_at"),
            "counts": manifest.get("counts", {}),
            "checkpoint": manifest.get("checkpoint"),
            "phase": manifest.get("phase"),
            "project_progress": manifest.get("project_progress", []),
            "pause_supported": manifest.get("pause_supported", False),
        })
    return sorted(runs, key=lambda item: str(item.get("updated_at") or item.get("created_at") or ""), reverse=True)


def _load_source_index(run_dir: Path) -> dict[str, Any]:
    try:
        value = json.loads((run_dir / "source-index.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise FileNotFoundError(f"Source index not found for import run: {run_dir.name}") from error
    if not isinstance(value, dict):
        raise ValueError("Source index must be a JSON object")
    return value


def _source_catalog(source_index: dict[str, Any]) -> dict[str, dict[str, Any]]:
    catalog: dict[str, dict[str, Any]] = {}
    for conversation in source_index.get("chat", {}).get("conversations", []):
        source_id = conversation.get("source_id")
        if not source_id:
            continue
        source_ref = f"chat:{source_id}"
        catalog.setdefault(source_ref, {**conversation, "source_ref": source_ref, "kind": "chat", "client": "chat"})
    for session in source_index.get("code", {}).get("sessions", []):
        source_id = session.get("source_id")
        if not source_id:
            continue
        source_ref = f"code:{source_id}"
        catalog.setdefault(source_ref, {**session, "source_ref": source_ref, "kind": "code", "client": "code"})
    for client_id, entry in source_index.get("clients", {}).items():
        for source in entry.get("sources", []):
            source_id = source.get("source_id")
            source_ref = source.get("source_ref") or (f"{client_id}:{source_id}" if source_id else "")
            if source_ref:
                catalog.setdefault(source_ref, {**source, "source_ref": source_ref, "client": client_id})
    return catalog


def _validated_source_path(path: str | Path, allowed_root: str | Path) -> Path:
    candidate = Path(path).expanduser().resolve()
    root = Path(allowed_root).expanduser().resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise ValueError(f"Indexed path is outside allowed source root: {candidate}") from error
    if not candidate.is_file():
        raise FileNotFoundError(f"Indexed source file not found: {candidate}")
    return candidate


def _load_candidates(run_dir: Path) -> dict[str, Any]:
    path = run_dir / "project-candidates.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise FileNotFoundError("project-candidates.json not found — run prepare first") from error
    if not isinstance(data, dict) or not isinstance(data.get("candidates"), list):
        raise ValueError("project-candidates.json is malformed")
    return data


def _load_dedup_report(run_dir: Path) -> dict[str, Any]:
    try:
        value = json.loads((run_dir / "dedup-report.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"canonical_by_ref": {}}
    return value if isinstance(value, dict) else {"canonical_by_ref": {}}


def _load_project_proposal(run_dir: Path) -> dict[str, Any]:
    """Load the agent's decision layer; raw discovery stays in project-candidates.json."""
    path = run_dir / "project-proposal.json"
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        value = {}
    if not isinstance(value, dict):
        value = {}
    status = value.get("status")
    return {
        "schema_version": 1,
        "status": status if status in {"draft", "finalized"} else "draft",
        "projects": value.get("projects") if isinstance(value.get("projects"), list) else [],
        "learning": value.get("learning") if isinstance(value.get("learning"), list) else [],
        "noise": value.get("noise") if isinstance(value.get("noise"), list) else [],
    }


def _visible_source_metadata(source: dict[str, Any]) -> dict[str, Any]:
    """Safe, human-facing source metadata for the web. Never expose UUIDs or raw text."""
    if source.get("kind") == "chat":
        return {
            "title": str(source.get("title") or "Untitled Chat"),
            "summary": str(source.get("summary") or ""),
            "created_at": source.get("created_at"),
            "message_count": source.get("message_count") or 0,
        }
    return {
        "title": str(source.get("title") or "Untitled Claude Code session"),
        "first_prompt": str(source.get("first_prompt") or ""),
        "created_at": source.get("created_at"),
    }


def classify_import_sources(
    *,
    data_root: str | Path,
    run_id: str,
    classification: str,
    source_refs: list[str],
    note: str = "",
) -> list[dict[str, Any]]:
    """Record project-independent learning/noise decisions from source metadata."""
    if classification not in {"learning", "noise"}:
        raise ValueError("Classification must be learning or noise; projects use propose-project")
    root = Path(data_root).expanduser()
    run_dir, _ = _load_run_manifest(root, run_id)
    catalog = _source_catalog(_load_source_index(run_dir))
    refs = list(dict.fromkeys(source_refs))
    unknown = [source_ref for source_ref in refs if source_ref not in catalog]
    if unknown:
        raise ValueError(f"Unknown source refs: {', '.join(unknown)}")
    proposal = _load_project_proposal(run_dir)
    existing = {str(item.get("source_ref")): item for item in proposal[classification] if isinstance(item, dict)}
    rows = []
    for source_ref in refs:
        item = {"source_ref": source_ref, "note": note.strip(), **_visible_source_metadata(catalog[source_ref])}
        existing[source_ref] = item
        rows.append(item)
    proposal[classification] = list(existing.values())
    _write_json(run_dir / "project-proposal.json", proposal)
    _append_run_event(run_dir, "sources_classified", classification=classification, source_count=len(refs))
    return rows


def propose_project(
    *,
    data_root: str | Path,
    run_id: str,
    name: str,
    summary: str,
    source_refs: list[str] | None = None,
    candidate_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Write one agent-classified project proposal for the web selection view.

    Discovery intentionally remains raw (`project-candidates.json`). This is the
    decision layer: only rows classified as real projects land here. Source refs
    may be passed directly from title/summary analysis, and candidate ids add all
    sources already belonging to a selected Claude Code workspace.
    """
    root = Path(data_root).expanduser()
    run_dir, _ = _load_run_manifest(root, run_id)
    catalog = _source_catalog(_load_source_index(run_dir))
    candidates = _load_candidates(run_dir)["candidates"]
    canonical_by_ref = _load_dedup_report(run_dir).get("canonical_by_ref") or {}
    by_id = {str(item.get("id")): item for item in candidates if isinstance(item, dict) and item.get("id")}

    wanted = list(dict.fromkeys(str(canonical_by_ref.get(ref, ref)) for ref in (source_refs or [])))
    selected_candidates = list(dict.fromkeys(candidate_ids or []))
    unknown_candidates = [candidate_id for candidate_id in selected_candidates if candidate_id not in by_id]
    if unknown_candidates:
        raise ValueError(f"Unknown candidate ids: {', '.join(unknown_candidates)}")
    for candidate_id in selected_candidates:
        wanted.extend(str(canonical_by_ref.get(ref, ref)) for ref in (by_id[candidate_id].get("source_refs") or []))
    wanted = list(dict.fromkeys(wanted))
    unknown_refs = [source_ref for source_ref in wanted if source_ref not in catalog]
    if unknown_refs:
        raise ValueError(f"Unknown source refs: {', '.join(unknown_refs)}")
    if not wanted:
        raise ValueError("A project proposal needs at least one linked source")

    proposal = _load_project_proposal(run_dir)
    project_id = f"project:{_candidate_key(name)}"
    item = next((row for row in proposal["projects"] if isinstance(row, dict) and row.get("id") == project_id), None)
    claimed_elsewhere = {
        str(source_ref): str(row.get("name") or row.get("id"))
        for row in proposal["projects"]
        if isinstance(row, dict) and row.get("id") != project_id
        for source_ref in (row.get("source_refs") or [])
    }
    conflicts = [source_ref for source_ref in wanted if source_ref in claimed_elsewhere]
    if conflicts:
        owners = ", ".join(f"{source_ref} ({claimed_elsewhere[source_ref]})" for source_ref in conflicts[:3])
        raise ValueError(f"Source already belongs to proposal: {owners}")
    if item is None:
        item = {"id": project_id, "classification": "project"}
        proposal["projects"].append(item)
    all_refs = list(dict.fromkeys([*(item.get("source_refs") or []), *wanted]))
    all_candidates = list(dict.fromkeys([*(item.get("candidate_ids") or []), *selected_candidates]))
    item.update(
        {
            "name": name.strip(),
            "summary": summary.strip(),
            "candidate_ids": all_candidates,
            "source_refs": all_refs,
            # Targets are planning guidance only; no Tasks are fabricated here.
            "sector": item.get("sector", ""),
            "one_liner": item.get("one_liner", ""),
            "logo": item.get("logo") or {"status": "not_provided", "question": "Would you like to add a project logo?"},
            "suggested_plan": {"Discovery": 2, "Build": 5, "Growth": 3},
            "chat": [_visible_source_metadata(catalog[ref]) for ref in all_refs if catalog[ref].get("kind") == "chat"],
            "claude_code": [_visible_source_metadata(catalog[ref]) for ref in all_refs if catalog[ref].get("kind") == "code"],
        }
    )
    _write_json(run_dir / "project-proposal.json", proposal)
    _append_run_event(run_dir, "project_proposed", project_id=project_id, source_count=len(all_refs))
    return item


def finalize_project_proposal(*, data_root: str | Path, run_id: str) -> dict[str, Any]:
    """Seal a complete proposal so the web can safely enable Save."""
    run_dir, _ = _load_run_manifest(data_root, run_id)
    proposal = _load_project_proposal(run_dir)
    if not proposal["projects"]:
        raise ValueError("Cannot finalize an empty project proposal")
    owners: dict[str, str] = {}
    for project in proposal["projects"]:
        if not isinstance(project, dict):
            continue
        for source_ref in project.get("source_refs") or []:
            previous = owners.setdefault(str(source_ref), str(project.get("name") or project.get("id")))
            if previous != str(project.get("name") or project.get("id")):
                raise ValueError(f"Cannot finalize: source {source_ref} belongs to both {previous} and {project.get('name')}")
    proposal["status"] = "finalized"
    _write_json(run_dir / "project-proposal.json", proposal)
    _append_run_event(run_dir, "project_proposal_finalized", project_count=len(proposal["projects"]))
    return {"status": "finalized", "project_count": len(proposal["projects"])}


def _chat_export_row(source_index: dict[str, Any], source_id: str) -> dict[str, Any]:
    """Locate one Chat export row locally without returning unrelated conversations."""
    export_dir = Path(source_index["chat"]["export_dir"])
    archive_names = source_index["chat"].get("archives", {}).get("conversations", [])
    for archive_name in archive_names:
        archive_path = _validated_source_path(export_dir / archive_name, export_dir)
        with zipfile.ZipFile(archive_path) as archive:
            for name in archive.namelist():
                if not name.endswith("conversations.json"):
                    continue
                rows = _json_from_zip(archive, name)
                row = next((item for item in rows if isinstance(item, dict) and item.get("uuid") == source_id), None)
                if row is not None:
                    return row
    raise FileNotFoundError(f"Chat source content not found: chat:{source_id}")


def materialize_proposal_chat_views(*, data_root: str | Path, run_id: str, page_size: int = 20) -> dict[str, Any]:
    """Copy only proposed Chat messages into private, page-sized local viewer files."""
    if not 1 <= page_size <= 100:
        raise ValueError("page_size must be between 1 and 100")
    run_dir, _ = _load_run_manifest(data_root, run_id)
    proposal = _load_project_proposal(run_dir)
    if proposal["status"] != "finalized":
        raise ValueError("Finalize the project proposal before materializing Chat views")
    source_index = _load_source_index(run_dir)
    catalog = _source_catalog(source_index)
    view: dict[str, Any] = {"schema_version": 1, "projects": {}, "errors": []}
    written = 0
    for project in proposal["projects"]:
        if not isinstance(project, dict) or not project.get("id"):
            continue
        entries: list[dict[str, Any]] = []
        for source_ref in project.get("source_refs") or []:
            source = catalog.get(source_ref)
            if not source or source.get("kind") != "chat":
                continue
            digest = hashlib.sha256(str(source_ref).encode("utf-8")).hexdigest()[:20]
            try:
                row = _chat_export_row(source_index, str(source.get("source_id")))
                messages = [
                    {
                        "sender": str(message.get("sender") or "unknown"),
                        "text": str(message.get("text") or ""),
                        "created_at": message.get("created_at"),
                    }
                    for message in (row.get("chat_messages") or [])
                    if isinstance(message, dict)
                ]
                pages = []
                for start in range(0, len(messages), page_size):
                    relative = f"chat-pages/{digest}/page-{start // page_size + 1:04d}.json"
                    _write_json(run_dir / relative, {"messages": messages[start : start + page_size]})
                    pages.append(relative)
                entries.append({
                    "title": str(source.get("title") or "Untitled Chat"),
                    "summary": str(source.get("summary") or ""),
                    "created_at": source.get("created_at"),
                    "message_count": len(messages),
                    "pages": pages,
                })
                written += 1
            except (OSError, ValueError, zipfile.BadZipFile, json.JSONDecodeError) as error:
                view["errors"].append({"project_id": project["id"], "title": str(source.get("title") or "Untitled Chat"), "message": str(error)})
        view["projects"][project["id"]] = entries
    _write_json(run_dir / "chat-view.json", view)
    _append_run_event(run_dir, "chat_views_materialized", written=written, errors=len(view["errors"]))
    return {"written": written, "errors": len(view["errors"])}


def assign_sources(
    *,
    data_root: str | Path,
    run_id: str,
    candidate_id: str,
    source_refs: list[str] | None = None,
    summary: str | None = None,
) -> dict[str, Any]:
    """Record the agent's source assignment and evidence summary for one candidate.

    Claude Chat exports carry no conversation→project link, so only the agent can decide
    which conversations belong to which project, from titles and summaries. This writes
    that judgment back into project-candidates.json — the file the web selection view and
    apply-selections both read. Without it a chat project is confirmed with zero sources
    and its source queue is empty, so no task cards can ever be produced for it.
    """
    root = Path(data_root).expanduser()
    run_dir, _ = _load_run_manifest(root, run_id)
    data = _load_candidates(run_dir)
    candidates = data["candidates"]
    target = next(
        (item for item in candidates if isinstance(item, dict) and item.get("id") == candidate_id),
        None,
    )
    if target is None:
        raise ValueError(f"Unknown candidate: {candidate_id}")

    if source_refs:
        catalog = _source_catalog(_load_source_index(run_dir))
        wanted = list(dict.fromkeys(source_refs))
        unknown = [source_ref for source_ref in wanted if source_ref not in catalog]
        if unknown:
            raise ValueError(f"Unknown source refs: {', '.join(unknown)}")
        # One source belongs to exactly one project. A second assignment would
        # double-count it, so report the conflict instead of silently moving it.
        claimed = {
            source_ref
            for item in candidates
            if isinstance(item, dict) and item.get("id") != candidate_id
            for source_ref in (item.get("source_refs") or [])
        }
        conflicts = [source_ref for source_ref in wanted if source_ref in claimed]
        if conflicts:
            raise ValueError(
                "Already assigned to another candidate: "
                f"{', '.join(conflicts)} — remove it there first."
            )
        target["source_refs"] = list(dict.fromkeys([*(target.get("source_refs") or []), *wanted]))

    if summary is not None:
        target["summary"] = _safe_text(summary, 600)

    _write_json(run_dir / "project-candidates.json", data)
    _append_run_event(
        run_dir,
        "sources_assigned",
        candidate_id=candidate_id,
        source_refs=target.get("source_refs") or [],
        summary_written=summary is not None,
    )
    return target


def confirm_project(
    *,
    data_root: str | Path,
    run_id: str,
    name: str,
    sector: str = "",
    one_liner: str = "",
    source_refs: list[str] | None = None,
    order: int | None = None,
) -> dict[str, Any]:
    """Materialize a user-confirmed project without touching source exports."""
    ensure_project = _import_save_record().ensure_project

    root = Path(data_root).expanduser()
    run_dir, manifest = _load_run_manifest(root, run_id)
    if source_refs is not None:
        catalog = _source_catalog(_load_source_index(run_dir))
        source_refs = list(dict.fromkeys(source_refs))
        unknown = [source_ref for source_ref in source_refs if source_ref not in catalog]
        if unknown:
            raise ValueError(f"Unknown source refs: {', '.join(unknown)}")
    project = ensure_project(str(root), name, extra={"sector": sector, "one_liner": one_liner})
    if order is not None:
        # The web board orders projects by project.json `order`. ensure_project filters out
        # falsy extras, so 0 could not ride along inside `extra`; write it directly.
        project["order"] = order
        _write_json(root / project["slug"] / "project.json", project)
    confirmed = manifest.setdefault("confirmed_projects", [])
    item = next((item for item in confirmed if isinstance(item, dict) and item.get("id") == project["id"]), None)
    if item is None:
        item = {"id": project["id"], "name": project.get("name") or project["title"], "slug": project["slug"]}
        confirmed.append(item)
    if source_refs is not None:
        # Union, never replace: the skill passes every source of a merged project, and a
        # project can be confirmed more than once (e.g. once per merged candidate).
        # Overwriting silently dropped the earlier sources.
        item["source_refs"] = list(dict.fromkeys([*(item.get("source_refs") or []), *source_refs]))
    manifest["status"] = "source_task_curation"
    manifest["phase"] = "source_task_curation"
    manifest["updated_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    _write_json(run_dir / "manifest.json", manifest)
    return project


def project_source_queue(
    *, data_root: str | Path, run_id: str, project_name: str
) -> list[dict[str, Any]]:
    """Return one confirmed project's unprocessed sources, oldest first."""
    run_dir, manifest = _load_run_manifest(data_root, run_id)
    project = next(
        (
            item
            for item in manifest.get("confirmed_projects", [])
            if isinstance(item, dict) and str(item.get("name", "")).casefold() == project_name.casefold()
        ),
        None,
    )
    if project is None:
        raise ValueError(f"Confirmed project not found: {project_name}")
    completed = {
        item.get("source_ref")
        for item in manifest.get("source_progress", [])
        if isinstance(item, dict) and item.get("project_id") == project.get("id")
    }
    catalog = _source_catalog(_load_source_index(run_dir))
    queue = [
        catalog[source_ref]
        for source_ref in project.get("source_refs", [])
        if source_ref in catalog and source_ref not in completed
    ]
    return sorted(queue, key=lambda item: (item.get("created_at") or "9999", item["source_ref"]))


def read_source(
    *, data_root: str | Path, run_id: str, project_name: str, source_ref: str
) -> dict[str, Any]:
    """Read one exact source selected from the private import index."""
    run_dir, manifest = _load_run_manifest(data_root, run_id)
    source_index = _load_source_index(run_dir)
    catalog = _source_catalog(source_index)
    metadata = catalog.get(source_ref)
    if metadata is None:
        raise ValueError(f"Unknown source ref: {source_ref}")
    project = next(
        (
            item
            for item in manifest.get("confirmed_projects", [])
            if isinstance(item, dict) and str(item.get("name", "")).casefold() == project_name.casefold()
        ),
        None,
    )
    if project is None or source_ref not in project.get("source_refs", []):
        raise ValueError(f"Source is not assigned to confirmed project: {source_ref}")

    if metadata["kind"] == "code":
        try:
            from .adapters.claude_code import ClaudeCodeAdapter
        except ImportError:
            from adapters.claude_code import ClaudeCodeAdapter
        _validated_source_path(metadata["transcript_file"], Path(source_index["code"]["config_dir"]) / "projects")
        content = ClaudeCodeAdapter(source_index["code"]["config_dir"]).read(str(metadata["source_id"])).content
    else:
        try:
            from .adapters.claude_chat_export import ClaudeChatExportAdapter
        except ImportError:
            from adapters.claude_chat_export import ClaudeChatExportAdapter
        content = ClaudeChatExportAdapter(source_index["chat"]["export_dir"]).read(str(metadata["source_id"])).content
    # Reading is the durable helper checkpoint that unlocks a task proposal.
    # The source itself remains untouched; only run metadata is updated.
    read_sources = manifest.setdefault("read_sources", [])
    if source_ref not in read_sources:
        read_sources.append(source_ref)
    manifest["updated_at"] = _utc_now()
    _write_json(run_dir / "manifest.json", manifest)
    return {"source_ref": source_ref, "metadata": metadata, "content": content}


def propose_task(
    *, data_root: str | Path, run_id: str, project_name: str, source_ref: str,
    title: str, body: str, purpose: str = "", stage: str = "Discovery",
    date: str | None = None, activities: list[str] | None = None,
    tools: list[str] | None = None, mindset: list[str] | None = None,
    task_aim: str = "", highlight: str = "", evidence_candidates: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Persist a Task proposal only after project confirmation and source reading."""
    if not isinstance(title, str) or not title.strip() or not isinstance(body, str) or not body.strip():
        raise ValueError("Task proposal requires a title and body")
    root = Path(data_root).expanduser()
    run_dir, manifest = _load_run_manifest(root, run_id)
    phase = manifest.get("phase") or manifest.get("status")
    if phase != "source_task_curation" or not manifest.get("confirmed_projects"):
        raise ValueError("Task proposals require a confirmed project")
    project = next((item for item in manifest["confirmed_projects"] if isinstance(item, dict) and str(item.get("name", "")).casefold() == project_name.casefold()), None)
    if project is None or source_ref not in (project.get("source_refs") or []):
        raise ValueError("Source is not assigned to confirmed project")
    if source_ref not in (manifest.get("read_sources") or []):
        raise ValueError("read and curate the source before creating Task proposals")
    proposal_id = f"task-{uuid.uuid4().hex[:12]}"
    metadata = _source_catalog(_load_source_index(run_dir)).get(source_ref, {})
    proposal = {
        "id": proposal_id, "source_ref": source_ref, "project": project_name,
        "purpose": purpose.strip(), "stage": stage.strip() or "Discovery",
        "title": title.strip(), "date": date or str(metadata.get("created_at") or "")[:10],
        "activities": list(activities or []), "task_aim": task_aim.strip(),
        "tools": list(tools or []), "mindset": list(mindset or []), "body": body.strip(),
        "highlight": highlight.strip(), "evidence_candidates": list(evidence_candidates or []),
        "status": "pending",
    }
    _write_json(run_dir / "task-proposals" / f"{proposal_id}.json", proposal)
    _append_run_event(run_dir, "task_proposed", proposal_id=proposal_id, source_ref=source_ref, project_id=project.get("id"))
    return proposal


def complete_source(
    *,
    data_root: str | Path,
    run_id: str,
    project_name: str | None,
    source_ref: str,
    outcome: str,
    record_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Persist that one source was saved, dropped, or postponed."""
    if outcome not in {"saved", "dropped", "postponed"}:
        raise ValueError("outcome must be saved, dropped, or postponed")
    clean_record_ids = list(dict.fromkeys(str(item).strip() for item in (record_ids or []) if str(item).strip()))
    if outcome == "saved" and not clean_record_ids:
        raise ValueError("A saved source requires at least one persisted Task ID (--record-id)")
    run_dir, manifest = _load_run_manifest(data_root, run_id)
    catalog = _source_catalog(_load_source_index(run_dir))
    if source_ref not in catalog:
        raise ValueError(f"Unknown source ref: {source_ref}")
    project = None
    if project_name is not None:
        project = next(
            (
                item
                for item in manifest.get("confirmed_projects", [])
                if isinstance(item, dict) and str(item.get("name", "")).casefold() == project_name.casefold()
            ),
            None,
        )
        if project is None or source_ref not in project.get("source_refs", []):
            raise ValueError(f"Source is not assigned to confirmed project: {source_ref}")
    elif outcome != "postponed":
        raise ValueError("An unassigned source can only be postponed")
    project_id = project.get("id") if project else None
    progress = manifest.setdefault("source_progress", [])
    entry = next(
        (
            item
            for item in progress
            if isinstance(item, dict)
            and item.get("project_id") == project_id
            and item.get("source_ref") == source_ref
        ),
        None,
    )
    if entry is None:
        entry = {
            "project_id": project_id,
            "project_name": project.get("name") if project else None,
            "source_ref": source_ref,
        }
        progress.append(entry)
    timestamp = _utc_now()
    entry.update({"outcome": outcome, "record_ids": clean_record_ids, "updated_at": timestamp})
    manifest["updated_at"] = timestamp
    manifest["checkpoint"] = {"stage": "source_task_curation", "last_source_ref": source_ref, "updated_at": timestamp}
    _write_json(run_dir / "manifest.json", manifest)

    root = Path(data_root).expanduser()
    ledger = _load_source_ledger(root)
    ledger_entry = ledger["sources"].setdefault(source_ref, {})
    prior_record_ids = ledger_entry.get("record_ids") if isinstance(ledger_entry.get("record_ids"), list) else []
    ledger_entry.update({
        "status": {"saved": "imported", "dropped": "dropped", "postponed": "postponed"}[outcome],
        "project_id": project_id,
        "project_name": project.get("name") if project else None,
        "record_ids": list(dict.fromkeys([*prior_record_ids, *clean_record_ids])),
        "last_run_id": run_id,
        "completed_at": timestamp,
    })
    _write_json(root / "imports" / "source-ledger.json", ledger)
    _append_run_event(run_dir, "source_completed", source_ref=source_ref, project_id=project_id, outcome=outcome, record_ids=clean_record_ids)
    return entry


def apply_selections(*, data_root: str | Path, run_id: str) -> dict[str, Any]:
    """Materialize project selections written by the web view.

    The web writes imports/<run-id>/selections.json with the user's project
    choices (confirm/rename/drop). This applies them through confirm_project so
    source refs and portfolio files are written by the helper, not the browser.
    """
    run_dir, _ = _load_run_manifest(data_root, run_id)
    selections_path = run_dir / "selections.json"
    try:
        selections = json.loads(selections_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise FileNotFoundError("selections.json not found — confirm projects in the web view first") from error

    candidates_path = run_dir / "project-candidates.json"
    candidates = json.loads(candidates_path.read_text(encoding="utf-8")).get("candidates", [])
    by_candidate_id = {str(candidate["id"]): candidate for candidate in candidates if isinstance(candidate, dict) and candidate.get("id")}
    proposal = _load_project_proposal(run_dir)
    by_proposal_id = {
        str(item["id"]): item
        for item in proposal["projects"]
        if isinstance(item, dict) and item.get("id")
    }

    entries = [item for item in selections.get("projects", []) if isinstance(item, dict)]
    # The table's row order becomes the board order, so apply them in the order the user
    # arranged. Anything unlisted keeps its file order, after the listed rows.
    order = [str(item) for item in (selections.get("order") or [])]

    def choice_id(entry: dict[str, Any]) -> str:
        return str(entry.get("proposal_id") or entry.get("candidate_id") or "")

    def source_for(choice: str) -> dict[str, Any] | None:
        return by_proposal_id.get(choice) or by_candidate_id.get(choice)

    def rank(entry: dict[str, Any]) -> int:
        selected_id = choice_id(entry)
        return order.index(selected_id) if selected_id in order else len(order)

    entries.sort(key=rank)

    # A merge is a parent row with children. Only the parent becomes a project and it
    # inherits every child's sources; writing a child as its own project would split it.
    absorbed = {str(child) for entry in entries for child in (entry.get("merged_from") or [])}

    confirmed: list[str] = []
    dropped: list[str] = []
    merged: list[str] = []
    without_sources: list[dict[str, str]] = []
    confirm_index = 0
    for entry in entries:
        selected_id = choice_id(entry)
        item = source_for(selected_id)
        if item is None or selected_id in absorbed:
            continue
        if entry.get("action") == "drop":
            dropped.append(selected_id)
            continue
        source_refs: list[str] = list(item.get("source_refs") or [])
        for child_id in (entry.get("merged_from") or []):
            child = source_for(str(child_id))
            if child is None:
                continue
            source_refs.extend(child.get("source_refs") or [])
            merged.append(str(child_id))
        source_refs = list(dict.fromkeys(source_refs))
        name = str(entry.get("name") or item.get("name") or "Untitled").strip()
        project = confirm_project(
            data_root=data_root,
            run_id=run_id,
            name=name,
            # These fields are intentionally deferred until cards are curated.
            sector=str(entry.get("sector") or ""),
            one_liner=str(entry.get("one_liner") or ""),
            source_refs=source_refs,
            order=confirm_index,
        )
        confirm_index += 1
        confirmed.append(project["slug"])
        if not source_refs:
            without_sources.append({"candidate_id": selected_id, "name": name})
    enrichment_proposals = []
    for project_slug in confirmed:
        project_path = Path(data_root).expanduser() / project_slug / "project.json"
        metadata = json.loads(project_path.read_text(encoding="utf-8"))
        if not metadata.get("sector") or not metadata.get("one_liner"):
            enrichment_proposals.append({
                "project_id": metadata.get("id"), "project_slug": project_slug,
                "name": metadata.get("title") or metadata.get("name") or project_slug,
                "sector": metadata.get("sector") or "", "one_liner": metadata.get("one_liner") or "",
                "status": "pending",
            })
    _write_json(run_dir / "project-enrichment-proposals.json", {"schema_version": 1, "proposals": enrichment_proposals})
    return {"confirmed": confirmed, "dropped": dropped, "merged": merged, "without_sources": without_sources, "enrichment_proposals": enrichment_proposals}


def _validate_task_approve_action(action: Any, run_id: str) -> dict[str, Any]:
    """Validate a task approval before it reaches the record writer.

    This deliberately accepts declarative task content only. In particular,
    evidence cannot carry source/artifact paths and an action cannot select an
    executable command or a destination path.
    """
    if not isinstance(action, dict) or set(action) != {"action", "run_id", "task"}:
        raise ValueError("Invalid task.approve action payload")
    if action.get("action") != "task.approve" or action.get("run_id") != run_id:
        raise ValueError("Invalid task.approve action payload")
    task = action.get("task")
    if not isinstance(task, dict) or not set(task).issubset(TASK_ACTION_FIELDS):
        raise ValueError("Invalid task.approve task payload")
    required_text = ("project", "goal", "stage", "title", "date", "body")
    for field in required_text:
        if not isinstance(task.get(field), str) or not task[field].strip():
            raise ValueError(f"task.approve requires a non-empty {field}")
    try:
        dt.date.fromisoformat(task["date"])
    except ValueError as error:
        raise ValueError("task.approve date must use YYYY-MM-DD") from error
    for field in ("purpose",):
        if field in task and not isinstance(task[field], str):
            raise ValueError(f"task.approve {field} must be a string")
    for field in ("activity", "tools", "mindset"):
        value = task.get(field, [])
        if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
            raise ValueError(f"task.approve {field} must be a list of strings")
    categories = task.get("tool_categories", {})
    try:
        tooling = _import_save_record().normalize_tooling_metadata(categories)
    except ValueError as error:
        raise ValueError(str(error)) from error
    if categories:
        if "tools" in task and task["tools"] and task["tools"] != tooling["tools"]:
            raise ValueError("task.approve tools must match tool_categories")
        task["tools"] = tooling["tools"]
    evidence = task.get("evidence", [])
    if not isinstance(evidence, list):
        raise ValueError("task.approve evidence must be a list")
    for item in evidence:
        if not isinstance(item, dict) or not set(item).issubset(TASK_EVIDENCE_FIELDS):
            raise ValueError("task.approve evidence contains unsupported fields")
        if not all(isinstance(value, (str, bool)) for value in item.values()):
            raise ValueError("task.approve evidence values must be strings or booleans")
        if "visibility" in item and item["visibility"] not in {"private", "public", "approved", "unverified"}:
            raise ValueError("task.approve evidence visibility must be private or public")
        if item.get("visibility") == "public" and item.get("verified") is not True:
            raise ValueError("task.approve public evidence must be verified")
        if "url" in item and (urlparse(item["url"]).scheme not in {"http", "https"} or not urlparse(item["url"]).netloc):
            raise ValueError("task.approve evidence URL must be http(s)")
        if "verified" in item and not isinstance(item["verified"], bool):
            raise ValueError("task.approve evidence verified must be boolean")
    highlight = task.get("highlight")
    if highlight is not None:
        if isinstance(highlight, str):
            pass
        elif isinstance(highlight, dict) and set(highlight).issubset(TASK_HIGHLIGHT_FIELDS) and all(
            isinstance(value, str) for value in highlight.values()
        ):
            pass
        else:
            raise ValueError("task.approve highlight must be text or an ai/builder/why object")
    return {
        field: task.get(field, [] if field in {"activity", "tools", "mindset", "evidence"} else ({} if field == "tool_categories" else ""))
        for field in TASK_ACTION_FIELDS
    }


def _resolve_approved_evidence(*, run_dir: Path, task: dict[str, Any]) -> list[dict[str, Any]]:
    """Resolve candidate IDs server-side; the web never supplies local paths."""
    candidates: dict[str, dict[str, Any]] = {}
    proposal_id = task.get("proposal_id")
    if isinstance(proposal_id, str) and proposal_id:
        try:
            proposal = json.loads((run_dir / "task-proposals" / f"{proposal_id}.json").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            proposal = {}
        for item in proposal.get("evidence_candidates", []) if isinstance(proposal, dict) else []:
            if isinstance(item, dict) and item.get("id"):
                candidates[str(item["id"])] = item
    resolved = []
    for item in task["evidence"]:
        row = dict(item)
        candidate = candidates.get(str(row.get("candidate_id")))
        if candidate:
            for key in ("source_path", "artifact_path"):
                if key in candidate:
                    row[key] = candidate[key]
            for key in ("kind", "type", "label", "url", "meta", "detail", "quote"):
                if key not in row and isinstance(candidate.get(key), str):
                    row[key] = candidate[key]
        if row.get("visibility") == "public":
            row["visibility"] = "approved"
        resolved.append(row)
    return resolved


def _apply_task_approve(*, data_root: str | Path, run_dir: Path, action: Any, run_id: str) -> dict[str, Any]:
    task = _validate_task_approve_action(action, run_id)
    task["evidence"] = _resolve_approved_evidence(run_dir=run_dir, task=task)
    save_record = _import_save_record()
    script = Path(getattr(save_record, "__file__", ""))
    if not script.is_file():
        raise RuntimeError("save_record.py is unavailable")
    with tempfile.TemporaryDirectory(prefix="task-approve-", dir=run_dir) as temp_dir:
        temporary = Path(temp_dir)
        body_path = temporary / "body.md"
        evidence_path = temporary / "evidence.json"
        body_path.write_text(task["body"], encoding="utf-8")
        evidence_path.write_text(json.dumps(task["evidence"], ensure_ascii=False), encoding="utf-8")
        command = [
            sys.executable, str(script), "--root", str(Path(data_root).expanduser()),
            "--project", task["project"], "--goal", task["goal"], "--stage", task["stage"],
            "--title", task["title"], "--date", task["date"],
            "--activity", ",".join(task["activity"]), "--purpose", task["purpose"],
            "--tools", ",".join(task["tools"]), "--mindset", ",".join(task["mindset"]),
            "--body-file", str(body_path), "--evidence-file", str(evidence_path),
        ]
        if task["tool_categories"]:
            command.extend(["--tool-categories", json.dumps(task["tool_categories"], ensure_ascii=False)])
        if isinstance(task["highlight"], str) and task["highlight"]:
            command.extend(["--judgment", task["highlight"]])
        elif isinstance(task["highlight"], dict):
            for field in ("ai", "builder", "why"):
                if task["highlight"].get(field):
                    command.extend([f"--highlight-{field}", task["highlight"][field]])
        completed = subprocess.run(command, check=False, capture_output=True, text=True)
    if completed.returncode != 0:
        raise RuntimeError(f"save_record.py failed: {completed.stderr.strip() or completed.stdout.strip()}")
    try:
        saved = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError("save_record.py returned invalid JSON") from error
    if not isinstance(saved, dict) or saved.get("ok") is not True or not isinstance(saved.get("record_id"), str):
        raise RuntimeError("save_record.py did not confirm a saved record")
    return saved


def _apply_task_drop(*, action: Any, run_id: str) -> dict[str, Any]:
    canonical = read_action_from_payload(action, run_id=run_id, action_name="task.drop")
    proposal_id = canonical["payload"].get("proposal_id")
    if not isinstance(proposal_id, str) or not proposal_id.strip():
        raise ValueError("task.drop requires a non-empty proposal_id")
    return {"status": "applied", "dropped": proposal_id}


def _apply_task_merge(*, data_root: str | Path, action: Any, run_id: str) -> dict[str, Any]:
    canonical = read_action_from_payload(action, run_id=run_id, action_name="task.merge")
    payload = canonical["payload"]
    try:
        from .task_actions import merge_tasks
    except ImportError:
        from task_actions import merge_tasks
    return merge_tasks(data_root, target_id=payload["target_id"], source_id=payload["source_id"])


def _validate_task_split_action(action: Any, run_id: str) -> dict[str, Any]:
    canonical = read_action_from_payload(action, run_id=run_id, action_name="task.split")
    payload = canonical["payload"]
    for draft in payload["children"]:
        if set(draft) - TASK_SPLIT_FIELDS:
            raise ValueError("task.split child contains unsupported fields")
        if not isinstance(draft.get("title"), str) or not draft["title"].strip():
            raise ValueError("task.split child requires a non-empty title")
        body = draft.get("body", draft.get("body_md"))
        if not isinstance(body, str) or not body.strip():
            raise ValueError("task.split child requires a non-empty body")
        for key in ("activities", "activity", "tools", "mindset", "source_refs"):
            if key in draft and (not isinstance(draft[key], list) or not all(isinstance(item, str) for item in draft[key])):
                raise ValueError(f"task.split {key} must be a list of strings")
        if "tool_categories" in draft:
            try:
                _import_save_record().normalize_tooling_metadata(draft["tool_categories"])
            except ValueError as error:
                raise ValueError(str(error)) from error
        if "evidence" in draft and not isinstance(draft["evidence"], list):
            raise ValueError("task.split evidence must be a list")
    return canonical


def _apply_task_split(*, data_root: str | Path, action: Any, run_id: str) -> dict[str, Any]:
    canonical = _validate_task_split_action(action, run_id)
    try:
        from .task_actions import split_task
    except ImportError:
        from task_actions import split_task
    payload = canonical["payload"]
    return split_task(data_root, source_id=payload["source_id"], children=payload["children"])


def read_action_from_payload(action: Any, *, run_id: str, action_name: str) -> dict[str, Any]:
    """Validate an in-memory action using the shared versioned protocol."""
    try:
        from .action_protocol import validate_action
    except ImportError:
        from action_protocol import validate_action
    return validate_action(action, run_id=run_id, action_name=action_name, allow_legacy=True)


def _apply_project_enrich(*, data_root: str | Path, action: Any, run_id: str) -> dict[str, Any]:
    canonical = read_action_from_payload(action, run_id=run_id, action_name="project.enrich")
    payload = canonical["payload"]
    try:
        from .project_actions import enrich_project
    except ImportError:
        from project_actions import enrich_project
    enriched = enrich_project(
        data_root,
        project_id=payload["project_id"],
        sector=payload["sector"],
        one_liner=payload["one_liner"],
    )
    proposal_path = Path(data_root).expanduser() / "imports" / run_id / "project-enrichment-proposals.json"
    try:
        proposal = json.loads(proposal_path.read_text(encoding="utf-8"))
        for item in proposal.get("proposals", []):
            if isinstance(item, dict) and item.get("project_id") == enriched.get("project_id"):
                item["status"] = "approved"
        _write_json(proposal_path, proposal)
    except (OSError, json.JSONDecodeError):
        pass
    return enriched


def apply_web_action(*, data_root: str | Path, run_id: str, action_name: str) -> dict[str, Any]:
    """Apply one allowlisted, run-scoped web action through the helper only."""
    if action_name not in WEB_ACTIONS:
        raise ValueError("Unsupported web action")
    run_dir, _ = _load_run_manifest(data_root, run_id)
    path = run_dir / "actions" / f"{action_name}.json"
    result_path = run_dir / "results" / f"{action_name}.json"
    try:
        previous = json.loads(result_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        previous = None
    if isinstance(previous, dict) and previous.get("status") == "applied":
        if isinstance(previous.get("result"), dict):
            return {**previous, **previous["result"]}
        return previous
    action = read_action(path, run_id=run_id, action_name=WEB_ACTIONS[action_name])
    payload = action["payload"]
    if action_name == "task-merge":
        result = {"status": "applied", **_apply_task_merge(data_root=data_root, action=action, run_id=run_id)}
        event_details = {"action": "task.merge", "target_id": payload["target_id"], "source_id": payload["source_id"]}
    elif action_name == "task-split":
        result = {"status": "applied", **_apply_task_split(data_root=data_root, action=action, run_id=run_id)}
        event_details = {"action": "task.split", "source_id": payload["source_id"], "child_count": len(payload["children"])}
    elif action_name == "project-merge":
        try:
            from .project_actions import merge_projects
        except ImportError:
            from project_actions import merge_projects
        result = {"status": "applied", **merge_projects(
            data_root, target_slug=payload["target_slug"], source_slug=payload["source_slug"]
        )}
        event_details = {"action": "project.merge", "target_slug": payload["target_slug"], "source_slug": payload["source_slug"]}
    elif action_name == "project-split":
        try:
            from .project_actions import split_project
        except ImportError:
            from project_actions import split_project
        result = {"status": "applied", **split_project(
            data_root,
            source_slug=payload["source_slug"],
            new_slug=payload["new_slug"],
            new_title=payload["new_title"],
            task_ids=payload["task_ids"],
            source_refs=payload["source_refs"],
        )}
        event_details = {"action": "project.split", "source_slug": payload["source_slug"], "new_slug": payload["new_slug"]}
    elif action_name == "project-confirm":
        projects = payload.get("projects")
        if not isinstance(projects, list) or not all(isinstance(project, dict) for project in projects):
            raise ValueError("Invalid project.confirm projects payload")
        selections = {
            "run_id": run_id,
            "order": [str(project.get("proposal_id") or "") for project in projects],
            "projects": projects,
        }
        _write_json(run_dir / "selections.json", selections)
        applied = apply_selections(data_root=data_root, run_id=run_id)
        result = {"status": "applied", **applied}
        event_details = {"action": "project.confirm", "confirmed": len(applied["confirmed"])}
    elif action_name == "project-enrich":
        enriched = _apply_project_enrich(data_root=data_root, action=action, run_id=run_id)
        result = {"status": "applied", **enriched}
        event_details = {"action": "project.enrich", "project_id": enriched["project_id"]}
    elif action_name == "task-approve":
        saved = _apply_task_approve(
            data_root=data_root,
            run_dir=run_dir,
            action={"action": action["action"], "run_id": run_id, "task": payload.get("task")},
            run_id=run_id,
        )
        result = {"status": "applied", **saved}
        event_details = {"action": "task.approve", "record_id": saved["record_id"]}
    else:
        result = _apply_task_drop(action=action, run_id=run_id)
        event_details = {"action": "task.drop", "proposal_id": result["dropped"]}
    envelope = create_result(action["action_id"], "applied", result)
    # Keep legacy flattened fields for callers while publishing the shared envelope.
    stored_result = {**envelope, **result}
    _write_json(result_path, envelope)
    _append_run_event(run_dir, "web_action_applied", action_id=action["action_id"], **event_details)
    return stored_result


def apply_pending_web_actions(*, data_root: str | Path, run_id: str) -> dict[str, Any]:
    """Apply every allowlisted web action that has no result yet (resume trigger)."""
    run_dir, _ = _load_run_manifest(data_root, run_id)
    actions_dir = run_dir / "actions"
    results_dir = run_dir / "results"
    applied: list[dict[str, Any]] = []
    if actions_dir.is_dir():
        for path in sorted(actions_dir.glob("*.json")):
            action_name = path.stem
            if action_name not in WEB_ACTIONS:
                continue
            try:
                stored = apply_web_action(data_root=data_root, run_id=run_id, action_name=action_name)
            except (FileNotFoundError, ValueError) as error:
                applied.append({"action": action_name, "status": "failed", "error": str(error)})
                continue
            applied.append({"action": action_name, "status": "applied" if isinstance(stored, dict) and stored.get("status") == "applied" else "unchanged"})
    return {"run_id": run_id, "applied": applied, "results_dir": str(results_dir)}


def wait_for_web_action(*, data_root: str | Path, run_id: str, action_name: str, timeout_seconds: int = 900) -> dict[str, Any]:
    if not 1 <= timeout_seconds <= 3600:
        raise ValueError("timeout_seconds must be between 1 and 3600")
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        try:
            return apply_web_action(data_root=data_root, run_id=run_id, action_name=action_name)
        except FileNotFoundError:
            time.sleep(0.5)
    return {"status": "timeout", "action": action_name}


def create_download_page(manifest_path: str | Path, output_path: str | Path) -> Path:
    """Create a local clickable export-download page without handling the URLs in chat."""
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    items = []
    for item in manifest.get("data_files", []):
        if not isinstance(item, dict) or item.get("category") not in VISIBLE_DOWNLOAD_CATEGORIES:
            continue
        category = str(item["category"])
        label = category.replace("_", " ").title()
        raw_url = str(item.get("export_url") or "")
        parsed_url = urlparse(raw_url)
        if parsed_url.scheme.lower() != "https" or not parsed_url.netloc:
            raise ValueError(f"Claude export URL must use HTTPS: {category}")
        url = html.escape(raw_url, quote=True)
        filename = html.escape(str(item.get("filename") or ""))
        items.append(f'<li><a href="{url}">{label}</a><small>{filename}</small></li>')
    body = "\n".join(items) or "<li>No downloadable export files were found.</li>"
    page = f"""<!doctype html>
<html lang=\"en\"><meta charset=\"utf-8\"><title>Download Claude export</title>
<style>body{{font:16px system-ui;max-width:680px;margin:48px auto;line-height:1.5;color:#1f2937}}li{{margin:14px 0}}a{{font-weight:700}}small{{display:block;color:#6b7280}}.note{{background:#f3f4f6;padding:14px;border-radius:8px}}</style>
<h1>Download your Claude export</h1>
<p>Open these links while signed in to Claude. Save every ZIP in the same folder. Do not unzip them.</p>
<ul>{body}</ul>
<p class=\"note\">Light metadata is intentionally excluded because it contains account and login information that is not needed for portfolio import.</p>
</html>"""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(page, encoding="utf-8")
    output.chmod(0o600)
    return output


def apply_project_logo_action(*, data_root: str | Path) -> dict[str, Any]:
    root = Path(data_root).expanduser().resolve()
    action_path = root / "actions" / "project-logo.json"
    result_path = root / "results" / "project-logo.json"
    try:
        previous = json.loads(result_path.read_text(encoding="utf-8"))
        if previous.get("status") == "applied": return previous
    except (OSError, json.JSONDecodeError):
        pass
    action = json.loads(action_path.read_text(encoding="utf-8"))
    try:
        from .project_actions import apply_logo_action
    except ImportError:
        from project_actions import apply_logo_action
    result = apply_logo_action(root, action=action, run_id="logo")
    envelope = create_result(action["action_id"], "applied", result)
    write_json_atomic(result_path, envelope)
    return {**envelope, **result}


def wait_for_project_logo_action(*, data_root: str | Path, timeout_seconds: int = 900) -> dict[str, Any]:
    if not 1 <= timeout_seconds <= 3600: raise ValueError("timeout_seconds must be between 1 and 3600")
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        try: return apply_project_logo_action(data_root=data_root)
        except FileNotFoundError: time.sleep(0.5)
    return {"status": "timeout", "action": "project-logo"}

def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare a local Claude import for Builder's Diary")
    sub = parser.add_subparsers(dest="command", required=True)
    page = sub.add_parser("download-page", help="Create a local page with safe export-download links")
    page.add_argument("--manifest", required=True)
    page.add_argument("--output", required=True)

    scan_export = sub.add_parser("scan-export", help="Read Claude export ZIP metadata")
    scan_export.add_argument("--export-dir", required=True)

    scan_code = sub.add_parser("scan-code", help="Read Claude Code main session metadata")
    scan_code.add_argument("--claude-config-dir", default="~/.claude")

    prepare = sub.add_parser("prepare", help="Create a private import run index")
    prepare.add_argument("--data-root", required=True)
    prepare.add_argument("--export-dir", required=True)
    prepare.add_argument("--claude-config-dir", default="~/.claude")
    prepare.add_argument("--sources", default="", help="Comma-separated selected local sources: cursor,codex,hermes")

    list_runs_cmd = sub.add_parser("list-runs", help="List resumable import runs without source content")
    list_runs_cmd.add_argument("--data-root", required=True)

    confirm_project_cmd = sub.add_parser("confirm-project", help="Write a user-confirmed portfolio project")
    confirm_project_cmd.add_argument("--data-root", required=True)
    confirm_project_cmd.add_argument("--run-id", required=True)
    confirm_project_cmd.add_argument("--name", required=True)
    confirm_project_cmd.add_argument("--sector", default="")
    confirm_project_cmd.add_argument("--one-liner", default="")
    confirm_project_cmd.add_argument("--source-ref", action="append", default=None)

    classify_sources_cmd = sub.add_parser("classify-sources", help="Record learning or noise sources; projects use propose-project")
    classify_sources_cmd.add_argument("--data-root", required=True)
    classify_sources_cmd.add_argument("--run-id", required=True)
    classify_sources_cmd.add_argument("--classification", required=True, choices=["learning", "noise"])
    classify_sources_cmd.add_argument("--source-ref", action="append", required=True)
    classify_sources_cmd.add_argument("--note", default="")

    propose_project_cmd = sub.add_parser("propose-project", help="Write one agent-classified project proposal for the web")
    propose_project_cmd.add_argument("--data-root", required=True)
    propose_project_cmd.add_argument("--run-id", required=True)
    propose_project_cmd.add_argument("--name", required=True)
    propose_project_cmd.add_argument("--summary", required=True)
    propose_project_cmd.add_argument("--source-ref", action="append", default=None)
    propose_project_cmd.add_argument("--candidate-id", action="append", default=None)

    propose_task_cmd = sub.add_parser("propose-task", help="Write a source-backed Task proposal after source curation")
    propose_task_cmd.add_argument("--data-root", required=True)
    propose_task_cmd.add_argument("--run-id", required=True)
    propose_task_cmd.add_argument("--project", required=True)
    propose_task_cmd.add_argument("--source-ref", required=True)
    propose_task_cmd.add_argument("--title", required=True)
    propose_task_cmd.add_argument("--body", required=True)
    propose_task_cmd.add_argument("--purpose", default="")
    propose_task_cmd.add_argument("--stage", default="Discovery")
    propose_task_cmd.add_argument("--task-aim", default="")

    finalize_proposal_cmd = sub.add_parser("finalize-proposal", help="Mark a complete proposal ready for web selection")
    finalize_proposal_cmd.add_argument("--data-root", required=True)
    finalize_proposal_cmd.add_argument("--run-id", required=True)

    materialize_chat_cmd = sub.add_parser("materialize-chat-views", help="Write page-sized selected Chat transcript files for the local viewer")
    materialize_chat_cmd.add_argument("--data-root", required=True)
    materialize_chat_cmd.add_argument("--run-id", required=True)
    materialize_chat_cmd.add_argument("--page-size", type=int, default=20)

    assign_sources_cmd = sub.add_parser(
        "assign-sources",
        help="Attach sources (and an evidence summary) to one project candidate",
    )
    assign_sources_cmd.add_argument("--data-root", required=True)
    assign_sources_cmd.add_argument("--run-id", required=True)
    assign_sources_cmd.add_argument("--candidate-id", required=True)
    assign_sources_cmd.add_argument("--summary", default=None)
    assign_sources_cmd.add_argument("--source-ref", action="append", default=None)

    logo_apply_cmd = sub.add_parser("apply-project-logo", help="Apply the validated local project logo action")
    logo_apply_cmd.add_argument("--data-root", required=True)
    logo_wait_cmd = sub.add_parser("wait-for-project-logo", help="Wait for and apply a local project logo action")
    logo_wait_cmd.add_argument("--data-root", required=True)
    logo_wait_cmd.add_argument("--timeout", type=int, default=900)

    apply_web_action_cmd = sub.add_parser("apply-web-action", help="Apply one validated action written by the connected web view")
    apply_web_action_cmd.add_argument("--data-root", required=True)
    apply_web_action_cmd.add_argument("--run-id", required=True)
    apply_web_action_cmd.add_argument("--action", required=True, choices=sorted(WEB_ACTIONS))

    wait_action_cmd = sub.add_parser("wait-for-action", help="Wait a bounded time for one web action and apply it")
    wait_action_cmd.add_argument("--data-root", required=True)
    wait_action_cmd.add_argument("--run-id", required=True)
    wait_action_cmd.add_argument("--action", required=True, choices=sorted(WEB_ACTIONS))
    wait_action_cmd.add_argument("--timeout", type=int, default=900)

    apply_selections_cmd = sub.add_parser("apply-selections", help="Materialize project selections written by the web view")
    apply_selections_cmd.add_argument("--data-root", required=True)
    apply_selections_cmd.add_argument("--run-id", required=True)

    apply_pending_cmd = sub.add_parser("apply-pending-actions", help="Apply all pending web actions for a run (resume trigger)")
    apply_pending_cmd.add_argument("--data-root", required=True)
    apply_pending_cmd.add_argument("--run-id", required=True)


    source_queue_cmd = sub.add_parser("source-queue", help="List a confirmed project's remaining sources oldest first")
    source_queue_cmd.add_argument("--data-root", required=True)
    source_queue_cmd.add_argument("--run-id", required=True)
    source_queue_cmd.add_argument("--project", required=True)

    read_source_cmd = sub.add_parser("read-source", help="Read one exact Chat or Claude Code source in full")
    read_source_cmd.add_argument("--data-root", required=True)
    read_source_cmd.add_argument("--run-id", required=True)
    read_source_cmd.add_argument("--project", required=True)
    read_source_cmd.add_argument("--source-ref", required=True)

    complete_source_cmd = sub.add_parser("complete-source", help="Record one source's curation outcome")
    complete_source_cmd.add_argument("--data-root", required=True)
    complete_source_cmd.add_argument("--run-id", required=True)
    complete_source_cmd.add_argument("--project")
    complete_source_cmd.add_argument("--source-ref", required=True)
    complete_source_cmd.add_argument("--outcome", required=True, choices=["saved", "dropped", "postponed"])
    complete_source_cmd.add_argument("--record-id", action="append", default=None)

    args = parser.parse_args()
    if args.command == "download-page":
        output = create_download_page(args.manifest, args.output)
        print(json.dumps({"ok": True, "page": str(output)}, ensure_ascii=False))
    elif args.command == "scan-export":
        print(json.dumps(scan_export_directory(args.export_dir), ensure_ascii=False, indent=2))
    elif args.command == "scan-code":
        print(json.dumps(scan_claude_code_sessions(args.claude_config_dir), ensure_ascii=False, indent=2))
    elif args.command == "prepare":
        selected = [item.strip() for item in args.sources.split(",") if item.strip()]
        if selected:
            try:
                from .client_roots import discover_default_roots
            except ImportError:
                from client_roots import discover_default_roots
            discovery = discover_default_roots(selected)
            roots = {client_id: item["path"] for client_id, item in discovery.items() if item.get("status") == "found"}
        else:
            discovery, roots = {}, {}
        result = prepare_import_run(data_root=args.data_root, export_dir=args.export_dir, claude_config_dir=args.claude_config_dir, selected_clients=roots)
        result["selected_source_discovery"] = discovery
        print(json.dumps(result, ensure_ascii=False, indent=2))
    elif args.command == "list-runs":
        print(json.dumps(list_import_runs(data_root=args.data_root), ensure_ascii=False, indent=2))
    elif args.command == "confirm-project":
        print(json.dumps(confirm_project(data_root=args.data_root, run_id=args.run_id, name=args.name, sector=args.sector, one_liner=args.one_liner, source_refs=args.source_ref), ensure_ascii=False, indent=2))
    elif args.command == "classify-sources":
        print(json.dumps(classify_import_sources(data_root=args.data_root, run_id=args.run_id, classification=args.classification, source_refs=args.source_ref, note=args.note), ensure_ascii=False, indent=2))
    elif args.command == "propose-project":
        print(json.dumps(propose_project(data_root=args.data_root, run_id=args.run_id, name=args.name, summary=args.summary, source_refs=args.source_ref, candidate_ids=args.candidate_id), ensure_ascii=False, indent=2))
    elif args.command == "propose-task":
        print(json.dumps(propose_task(data_root=args.data_root, run_id=args.run_id, project_name=args.project, source_ref=args.source_ref, title=args.title, body=args.body, purpose=args.purpose, stage=args.stage, task_aim=args.task_aim), ensure_ascii=False, indent=2))
    elif args.command == "finalize-proposal":
        print(json.dumps(finalize_project_proposal(data_root=args.data_root, run_id=args.run_id), ensure_ascii=False, indent=2))
    elif args.command == "materialize-chat-views":
        print(json.dumps(materialize_proposal_chat_views(data_root=args.data_root, run_id=args.run_id, page_size=args.page_size), ensure_ascii=False, indent=2))
    elif args.command == "assign-sources":
        print(json.dumps(assign_sources(data_root=args.data_root, run_id=args.run_id, candidate_id=args.candidate_id, source_refs=args.source_ref, summary=args.summary), ensure_ascii=False, indent=2))
    elif args.command == "apply-project-logo":
        print(json.dumps(apply_project_logo_action(data_root=args.data_root), ensure_ascii=False, indent=2))
    elif args.command == "wait-for-project-logo":
        print(json.dumps(wait_for_project_logo_action(data_root=args.data_root, timeout_seconds=args.timeout), ensure_ascii=False, indent=2))
    elif args.command == "apply-web-action":
        print(json.dumps(apply_web_action(data_root=args.data_root, run_id=args.run_id, action_name=args.action), ensure_ascii=False, indent=2))
    elif args.command == "wait-for-action":
        print(json.dumps(wait_for_web_action(data_root=args.data_root, run_id=args.run_id, action_name=args.action, timeout_seconds=args.timeout), ensure_ascii=False, indent=2))
    elif args.command == "apply-selections":
        print(json.dumps(apply_selections(data_root=args.data_root, run_id=args.run_id), ensure_ascii=False, indent=2))
    elif args.command == "apply-pending-actions":
        print(json.dumps(apply_pending_web_actions(data_root=args.data_root, run_id=args.run_id), ensure_ascii=False, indent=2))
    elif args.command == "source-queue":
        print(json.dumps(project_source_queue(data_root=args.data_root, run_id=args.run_id, project_name=args.project), ensure_ascii=False, indent=2))
    elif args.command == "read-source":
        print(json.dumps(read_source(data_root=args.data_root, run_id=args.run_id, project_name=args.project, source_ref=args.source_ref), ensure_ascii=False, indent=2))
    elif args.command == "complete-source":
        print(json.dumps(complete_source(data_root=args.data_root, run_id=args.run_id, project_name=args.project, source_ref=args.source_ref, outcome=args.outcome, record_ids=args.record_id), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
