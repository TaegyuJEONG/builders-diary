"""Safe, provenance-preserving actions on Builder's Diary Projects."""
from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Any

try:
    from .action_protocol import write_json_atomic
except ImportError:
    from action_protocol import write_json_atomic


_LIST_KEYS = {"source_refs", "sources", "source_ids", "tools", "tags", "tooling", "tooling_metadata"}


def _read(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid JSON: {path.name}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {path.name}")
    return value


def _union(a: Any, b: Any) -> list[Any]:
    values = []
    for item in (a if isinstance(a, list) else []) + (b if isinstance(b, list) else []):
        if item not in values:
            values.append(item)
    return values


def _union_metadata(target: dict[str, Any], source: dict[str, Any]) -> dict[str, Any]:
    merged = dict(target)
    for key, value in source.items():
        if key in _LIST_KEYS or "source" in key.lower() or "tool" in key.lower():
            if isinstance(value, list) or isinstance(merged.get(key), list):
                merged[key] = _union(merged.get(key), value)
            elif key not in merged:
                merged[key] = value
    return merged


def _safe_slug(value: str, label: str) -> str:
    if not isinstance(value, str) or not value.strip() or value.startswith(".") or "/" in value or "\\" in value or "\x00" in value:
        raise ValueError(f"Invalid {label}")
    return value.strip()


def _rewrite_record(path: Path, target: dict[str, Any], goal: dict[str, Any], folder: str) -> None:
    record = _read(path)
    record["folder"] = folder
    record["project_id"] = target["id"]
    record["project_slug"] = target["slug"]
    record["project_title"] = target.get("title") or target.get("name") or target["slug"]
    record["goal_id"] = goal["id"]
    record["goal_slug"] = goal["slug"]
    record["goal_title"] = goal.get("title") or goal["slug"]
    write_json_atomic(path, record)


def _rewrite_goal(path: Path, target: dict[str, Any], goal: dict[str, Any]) -> dict[str, Any]:
    goal = dict(goal)
    goal["project_slug"] = target["slug"]
    write_json_atomic(path, goal)
    return goal


def merge_projects(data_root: str | Path, *, target_slug: str, source_slug: str) -> dict[str, Any]:
    """Merge ``source_slug`` into ``target_slug`` with an all-or-nothing rollback."""
    root = Path(data_root).expanduser().resolve()
    target_slug = _safe_slug(target_slug, "target project slug")
    source_slug = _safe_slug(source_slug, "source project slug")
    if target_slug == source_slug:
        raise ValueError("Target and source projects must be different")
    target_dir, source_dir = root / target_slug, root / source_slug
    if not target_dir.is_dir() or not source_dir.is_dir():
        raise ValueError("Both target and source projects must exist")
    target_meta = _read(target_dir / "project.json")
    source_meta = _read(source_dir / "project.json")
    if target_meta.get("merged_into") or source_meta.get("merged_into"):
        raise ValueError("Merged redirect projects cannot be merged")
    target_meta.setdefault("slug", target_slug)
    source_meta.setdefault("slug", source_slug)

    snapshot = Path(tempfile.mkdtemp(prefix="builders-diary-merge-"))
    try:
        shutil.copytree(target_dir, snapshot / "target")
        shutil.copytree(source_dir, snapshot / "source")
        target_meta = _union_metadata(target_meta, source_meta)
        target_meta["slug"] = target_slug
        target_meta["updated_at"] = target_meta.get("updated_at") or source_meta.get("updated_at")

        for purpose_dir in sorted(source_dir.iterdir()):
            if not purpose_dir.is_dir() or purpose_dir.name.startswith("."):
                continue
            source_goal_path = purpose_dir / "goal.json"
            if not source_goal_path.is_file():
                raise ValueError(f"Purpose is missing goal.json: {purpose_dir.name}")
            source_goal = _read(source_goal_path)
            source_goal.setdefault("slug", purpose_dir.name)
            source_goal.setdefault("id", f"goal-{purpose_dir.name}")
            target_purpose = target_dir / purpose_dir.name
            if target_purpose.exists() and not target_purpose.is_dir():
                raise ValueError(f"Purpose path is not a directory: {purpose_dir.name}")
            if not target_purpose.exists():
                shutil.move(str(purpose_dir), str(target_purpose))
                target_goal = _rewrite_goal(target_purpose / "goal.json", target_meta, source_goal)
            else:
                target_goal_path = target_purpose / "goal.json"
                target_goal = _read(target_goal_path)
                target_goal = _union_metadata(target_goal, source_goal)
                target_goal["project_slug"] = target_slug
                write_json_atomic(target_goal_path, target_goal)
                for task_dir in sorted(purpose_dir.iterdir()):
                    if task_dir.name == "goal.json" or not task_dir.is_dir():
                        continue
                    destination = target_purpose / task_dir.name
                    if destination.exists():
                        suffix = 1
                        while (target_purpose / f"{task_dir.name}-merged-{suffix}").exists():
                            suffix += 1
                        destination = target_purpose / f"{task_dir.name}-merged-{suffix}"
                    shutil.move(str(task_dir), str(destination))
                    record_path = destination / "record.json"
                    if record_path.is_file():
                        _rewrite_record(record_path, target_meta, target_goal, destination.name)
                shutil.rmtree(purpose_dir)
            for record_path in sorted(target_purpose.glob("*/record.json")):
                _rewrite_record(record_path, target_meta, target_goal, record_path.parent.name)

        redirect = dict(source_meta)
        redirect["merged_into"] = {"id": target_meta["id"], "slug": target_slug, "title": target_meta.get("title") or target_meta.get("name") or target_slug}
        redirect["updated_at"] = target_meta.get("updated_at")
        write_json_atomic(target_dir / "project.json", target_meta)
        write_json_atomic(source_dir / "project.json", redirect)
        return {"status": "applied", "target_slug": target_slug, "source_slug": source_slug, "redirect": redirect["merged_into"]}
    except Exception:
        if target_dir.exists():
            shutil.rmtree(target_dir)
        if source_dir.exists():
            shutil.rmtree(source_dir)
        shutil.copytree(snapshot / "target", target_dir)
        shutil.copytree(snapshot / "source", source_dir)
        raise
    finally:
        shutil.rmtree(snapshot, ignore_errors=True)
