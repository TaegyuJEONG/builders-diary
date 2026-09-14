"""Declarative, rollback-safe merge and split operations for Tasks."""
from __future__ import annotations

import copy
import json
import re
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import Any

try:
    from .action_protocol import write_json_atomic
except ImportError:
    from action_protocol import write_json_atomic

_LIST_FIELDS = {"activities", "activity", "tools", "mindset", "evidence", "source_refs", "sources", "source_ids", "tags"}


def _read(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid Task JSON: {path}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"Task JSON must be an object: {path}")
    return value


def _union(a: Any, b: Any) -> list[Any]:
    result: list[Any] = []
    for value in (a if isinstance(a, list) else []) + (b if isinstance(b, list) else []):
        if value not in result:
            result.append(copy.deepcopy(value))
    return result


def _task_paths(root: Path) -> dict[str, Path]:
    found: dict[str, Path] = {}
    for path in root.glob("*/**/record.json"):
        if any(part.startswith(".") for part in path.relative_to(root).parts):
            continue
        record = _read(path)
        rid = record.get("id")
        if isinstance(rid, str) and rid:
            if rid in found:
                raise ValueError(f"Duplicate Task id: {rid}")
            found[rid] = path
    return found


def _snapshot(root: Path) -> Path:
    if not root.is_dir():
        raise ValueError("Task data root must exist")
    snapshot = Path(tempfile.mkdtemp(prefix="builders-diary-task-action-")) / "root"
    shutil.copytree(root, snapshot)
    return snapshot


def _restore(root: Path, snapshot: Path) -> None:
    for child in root.iterdir():
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()
    for child in snapshot.iterdir():
        destination = root / child.name
        if child.is_dir():
            shutil.copytree(child, destination)
        else:
            shutil.copy2(child, destination)


def _safe_text(value: Any, field: str, required: bool = False) -> str:
    if not isinstance(value, str) or not value.strip():
        if required:
            raise ValueError(f"{field} is required")
        return ""
    return value.strip()


def _combined_body(target: dict[str, Any], source: dict[str, Any]) -> str:
    left = str(target.get("body_md") or target.get("body") or "").strip()
    right = str(source.get("body_md") or source.get("body") or "").strip()
    if not right or right == left:
        return left
    if not left:
        return right
    return f"{left}\n\n---\n\n{right}"


def _combined_narrative(target: dict[str, Any], source: dict[str, Any]) -> list[Any]:
    return _union(target.get("narrative"), source.get("narrative"))


def merge_tasks(data_root: str | Path, *, target_id: str, source_id: str) -> dict[str, Any]:
    """Merge source into target while retaining source as a provenance redirect."""
    root = Path(data_root).expanduser().resolve()
    target_id = _safe_text(target_id, "target_id", True)
    source_id = _safe_text(source_id, "source_id", True)
    if target_id == source_id:
        raise ValueError("Target and source Tasks must be different")
    paths = _task_paths(root)
    if target_id not in paths or source_id not in paths:
        raise ValueError("Both target and source Tasks must exist")
    target_path, source_path = paths[target_id], paths[source_id]
    target = _read(target_path)
    source = _read(source_path)
    if target.get("merged_into") or target.get("split_into") or source.get("merged_into") or source.get("split_into"):
        raise ValueError("Redirect Tasks cannot be merged or split")
    snapshot = _snapshot(root)
    try:
        merged = copy.deepcopy(target)
        merged["body_md"] = _combined_body(target, source)
        merged["body"] = merged["body_md"]
        narrative = _combined_narrative(target, source)
        if narrative:
            merged["narrative"] = narrative
        for key in set(target) | set(source):
            if key in _LIST_FIELDS or "source" in key.lower() or "tool" in key.lower() or "mindset" in key.lower() or "evidence" in key.lower():
                if isinstance(target.get(key), list) or isinstance(source.get(key), list):
                    merged[key] = _union(target.get(key), source.get(key))
        merged["updated_at"] = merged.get("updated_at") or source.get("updated_at")
        redirect = copy.deepcopy(source)
        redirect["merged_into"] = {"id": target_id, "title": target.get("title", target_id), "file_path": str(target_path)}
        write_json_atomic(target_path, merged)
        write_json_atomic(source_path, redirect)
        return {"status": "applied", "target_id": target_id, "source_id": source_id, "redirect": redirect["merged_into"]}
    except Exception:
        _restore(root, snapshot)
        raise
    finally:
        shutil.rmtree(snapshot.parent, ignore_errors=True)


def _child_path(source_path: Path, title: str, index: int) -> Path:
    slug = re.sub(r"[^\w-]+", "-", title.lower(), flags=re.UNICODE).strip("-") or "task"
    date = re.sub(r"[^0-9]", "", str(index))
    return source_path.parent / f"{date.zfill(3)}-{slug}-{uuid.uuid4().hex[:6]}" / "record.json"


def split_task(data_root: str | Path, *, source_id: str, children: list[dict[str, Any]] | None = None, assignments: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """Split a source Task into at least two declarative child drafts."""
    root = Path(data_root).expanduser().resolve()
    source_id = _safe_text(source_id, "source_id", True)
    drafts = children if children is not None else assignments
    if not isinstance(drafts, list) or len(drafts) < 2:
        raise ValueError("Task split requires at least two child drafts")
    paths = _task_paths(root)
    if source_id not in paths:
        raise ValueError("Source Task does not exist")
    source_path = paths[source_id]
    source = _read(source_path)
    if source.get("merged_into") or source.get("split_into"):
        raise ValueError("Redirect Tasks cannot be split")
    validated: list[dict[str, Any]] = []
    for draft in drafts:
        if not isinstance(draft, dict) or not _safe_text(draft.get("title"), "child title", True) or not _safe_text(draft.get("body", draft.get("body_md")), "child body", True):
            raise ValueError("Each child requires a title and body")
        validated.append(draft)
    snapshot = _snapshot(root)
    try:
        child_ids: list[str] = []
        for index, draft in enumerate(validated, 1):
            child_id = f"r-{uuid.uuid4().hex[:8]}"
            title = _safe_text(draft["title"], "child title", True)
            body = _safe_text(draft.get("body", draft.get("body_md")), "child body", True)
            destination = _child_path(source_path, title, index)
            record = copy.deepcopy(source)
            record.update({"id": child_id, "title": title, "body": body, "body_md": body,
                           "folder": destination.parent.name, "created_at": draft.get("created_at", source.get("created_at")),
                           "updated_at": draft.get("updated_at", source.get("updated_at"))})
            for key in ("project", "project_slug", "project_id", "goal", "goal_slug", "goal_id", "section", "date", "purpose", "activities", "activity", "tools", "tool_categories", "mindset", "evidence", "source_refs"):
                if key in draft:
                    record[key] = copy.deepcopy(draft[key])
            destination.parent.mkdir(parents=True, exist_ok=False)
            write_json_atomic(destination, record)
            child_ids.append(child_id)
        redirect = copy.deepcopy(source)
        redirect["split_into"] = [{"id": child_id} for child_id in child_ids]
        write_json_atomic(source_path, redirect)
        return {"status": "applied", "source_id": source_id, "child_ids": child_ids}
    except Exception:
        _restore(root, snapshot)
        raise
    finally:
        shutil.rmtree(snapshot.parent, ignore_errors=True)
