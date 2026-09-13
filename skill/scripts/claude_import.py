#!/usr/bin/env python3
"""Local, read-only Claude import preparation for Builder's Diary.

This helper deliberately separates source discovery from model analysis:
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
import sys
import uuid
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

SCHEMA_VERSION = 1
EXPORT_CATEGORIES = {"conversations", "projects", "memories", "light_metadata"}
VISIBLE_DOWNLOAD_CATEGORIES = ("conversations", "projects", "memories")


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
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _source_fingerprint(source: dict[str, Any]) -> str:
    """Stable local fingerprint of safe source metadata, never raw transcript text."""
    safe = {
        key: source.get(key)
        for key in ("source_ref", "kind", "source_id", "title", "summary", "cwd", "created_at", "updated_at", "message_count")
    }
    encoded = json.dumps(safe, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return f"sha256:{hashlib.sha256(encoded).hexdigest()}"


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
) -> dict[str, Any]:
    """Build a private, resumable import index below data_root/imports only."""
    root = Path(data_root).expanduser()
    chat_index = scan_export_directory(export_dir)
    code_index = scan_claude_code_sessions(claude_config_dir)
    source_index = {"chat": chat_index, "code": code_index}
    classifications, _ = _classify_sources(root, _source_catalog(source_index))

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
        },
        "existing_projects": existing_projects,
        "warnings": [*chat_index["warnings"], *code_index["warnings"]],
    }
    _write_json(run_dir / "manifest.json", manifest)
    _write_json(run_dir / "source-index.json", source_index)
    _write_json(run_dir / "source-classification.json", {"sources": classifications})
    _write_json(run_dir / "project-candidates.json", _project_candidates(
        chat_index,
        code_index,
        {source_ref for source_ref, state in classifications.items() if state in {"new", "changed", "pending"}},
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
        catalog.setdefault(source_ref, {**conversation, "source_ref": source_ref, "kind": "chat"})
    for session in source_index.get("code", {}).get("sessions", []):
        source_id = session.get("source_id")
        if not source_id:
            continue
        source_ref = f"code:{source_id}"
        catalog.setdefault(source_ref, {**session, "source_ref": source_ref, "kind": "code"})
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
        projects_root = Path(source_index["code"]["config_dir"]) / "projects"
        transcript = _validated_source_path(metadata["transcript_file"], projects_root)
        content: Any = _read_jsonl(transcript)
    else:
        content = None
        export_dir = Path(source_index["chat"]["export_dir"])
        archive_names = source_index["chat"].get("archives", {}).get("conversations", [])
        for archive_name in archive_names:
            archive_path = _validated_source_path(export_dir / archive_name, export_dir)
            with zipfile.ZipFile(archive_path) as archive:
                for name in archive.namelist():
                    if not name.endswith("conversations.json"):
                        continue
                    rows = _json_from_zip(archive, name)
                    content = next(
                        (row for row in rows if isinstance(row, dict) and row.get("uuid") == metadata.get("source_id")),
                        None,
                    )
                    if content is not None:
                        break
            if content is not None:
                break
        if content is None:
            raise FileNotFoundError(f"Chat source content not found: {source_ref}")
    return {"source_ref": source_ref, "metadata": metadata, "content": content}


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
    by_id = {candidate["id"]: candidate for candidate in candidates if isinstance(candidate, dict)}

    confirmed: list[str] = []
    dropped: list[str] = []
    without_sources: list[dict[str, str]] = []
    for selection in selections.get("projects", []):
        if not isinstance(selection, dict):
            continue
        candidate_id = selection.get("candidate_id")
        candidate = by_id.get(candidate_id) if candidate_id else None
        if candidate is None:
            continue
        if selection.get("action") == "drop":
            dropped.append(candidate_id)
            continue
        name = str(selection.get("name") or candidate.get("name") or "Untitled").strip()
        source_refs = candidate.get("source_refs") or []
        project = confirm_project(
            data_root=data_root,
            run_id=run_id,
            name=name,
            sector=str(selection.get("sector") or ""),
            one_liner=str(selection.get("one_liner") or ""),
            source_refs=source_refs,
        )
        confirmed.append(project["slug"])
        if not source_refs:
            # The project now exists but nothing can ever be curated into it: its source
            # queue is empty. Surface it so the skill reports the gap instead of quietly
            # importing nothing for that project.
            without_sources.append({"candidate_id": str(candidate_id), "name": name})
    return {"confirmed": confirmed, "dropped": dropped, "without_sources": without_sources}


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

    list_runs_cmd = sub.add_parser("list-runs", help="List resumable import runs without source content")
    list_runs_cmd.add_argument("--data-root", required=True)

    confirm_project_cmd = sub.add_parser("confirm-project", help="Write a user-confirmed portfolio project")
    confirm_project_cmd.add_argument("--data-root", required=True)
    confirm_project_cmd.add_argument("--run-id", required=True)
    confirm_project_cmd.add_argument("--name", required=True)
    confirm_project_cmd.add_argument("--sector", default="")
    confirm_project_cmd.add_argument("--one-liner", default="")
    confirm_project_cmd.add_argument("--source-ref", action="append", default=None)

    assign_sources_cmd = sub.add_parser(
        "assign-sources",
        help="Attach sources (and an evidence summary) to one project candidate",
    )
    assign_sources_cmd.add_argument("--data-root", required=True)
    assign_sources_cmd.add_argument("--run-id", required=True)
    assign_sources_cmd.add_argument("--candidate-id", required=True)
    assign_sources_cmd.add_argument("--summary", default=None)
    assign_sources_cmd.add_argument("--source-ref", action="append", default=None)

    apply_selections_cmd = sub.add_parser("apply-selections", help="Materialize project selections written by the web view")
    apply_selections_cmd.add_argument("--data-root", required=True)
    apply_selections_cmd.add_argument("--run-id", required=True)


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
        print(json.dumps(prepare_import_run(data_root=args.data_root, export_dir=args.export_dir, claude_config_dir=args.claude_config_dir), ensure_ascii=False, indent=2))
    elif args.command == "list-runs":
        print(json.dumps(list_import_runs(data_root=args.data_root), ensure_ascii=False, indent=2))
    elif args.command == "confirm-project":
        print(json.dumps(confirm_project(data_root=args.data_root, run_id=args.run_id, name=args.name, sector=args.sector, one_liner=args.one_liner, source_refs=args.source_ref), ensure_ascii=False, indent=2))
    elif args.command == "assign-sources":
        print(json.dumps(assign_sources(data_root=args.data_root, run_id=args.run_id, candidate_id=args.candidate_id, source_refs=args.source_ref, summary=args.summary), ensure_ascii=False, indent=2))
    elif args.command == "apply-selections":
        print(json.dumps(apply_selections(data_root=args.data_root, run_id=args.run_id), ensure_ascii=False, indent=2))
    elif args.command == "source-queue":
        print(json.dumps(project_source_queue(data_root=args.data_root, run_id=args.run_id, project_name=args.project), ensure_ascii=False, indent=2))
    elif args.command == "read-source":
        print(json.dumps(read_source(data_root=args.data_root, run_id=args.run_id, project_name=args.project, source_ref=args.source_ref), ensure_ascii=False, indent=2))
    elif args.command == "complete-source":
        print(json.dumps(complete_source(data_root=args.data_root, run_id=args.run_id, project_name=args.project, source_ref=args.source_ref, outcome=args.outcome, record_ids=args.record_id), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
