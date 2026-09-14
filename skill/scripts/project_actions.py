"""Safe, provenance-preserving actions on Builder's Diary Projects."""
from __future__ import annotations

import datetime as dt
import json
import shutil
import tempfile
import uuid
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


def enrich_project(data_root: str | Path, *, project_id: str, sector: str, one_liner: str) -> dict[str, Any]:
    """Atomically apply the approved, allowlisted Project story fields."""
    if not all(isinstance(value, str) and value.strip() for value in (project_id, sector, one_liner)):
        raise ValueError("Project enrichment requires a project_id, sector, and one_liner")
    root = Path(data_root).expanduser().resolve()
    matches: list[Path] = []
    for project_json in root.glob("*/project.json"):
        try:
            metadata = _read(project_json)
        except ValueError:
            continue
        if metadata.get("id") == project_id or metadata.get("slug") == project_id:
            matches.append(project_json)
    if len(matches) != 1:
        raise ValueError("Project identifier must match exactly one project")
    path = matches[0]
    metadata = _read(path)
    metadata.update({"sector": sector.strip(), "one_liner": one_liner.strip()})
    metadata["updated_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    write_json_atomic(path, metadata)
    return {"status": "applied", "project_id": metadata.get("id"), "project_slug": metadata.get("slug"), "sector": metadata["sector"], "one_liner": metadata["one_liner"]}


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


def split_project(
    data_root: str | Path,
    *,
    source_slug: str,
    new_slug: str,
    new_title: str,
    task_ids: list[str] | None = None,
    source_refs: list[str] | None = None,
) -> dict[str, Any]:
    """Create a new project and move only explicitly selected Tasks/source refs.

    The source project is never replaced by a redirect: an empty source remains a
    normal project. The snapshot covers both projects, so a partial move cannot
    leak if validation, filesystem, or breadcrumb rewriting fails.
    """
    root = Path(data_root).expanduser().resolve()
    source_slug = _safe_slug(source_slug, "source project slug")
    new_slug = _safe_slug(new_slug, "new project slug")
    if source_slug == new_slug:
        raise ValueError("Source and new project slugs must be different")
    if not isinstance(new_title, str) or not new_title.strip():
        raise ValueError("New project title is required")
    selected_ids = {item for item in (task_ids or []) if isinstance(item, str) and item.strip()}
    selected_refs = {item for item in (source_refs or []) if isinstance(item, str) and item.strip()}
    if not selected_ids and not selected_refs:
        raise ValueError("An explicit task or source selection is required")

    source_dir, target_dir = root / source_slug, root / new_slug
    if not source_dir.is_dir():
        raise ValueError("Source project must exist")
    if target_dir.exists():
        raise ValueError("New project already exists")
    source_meta = _read(source_dir / "project.json")
    if source_meta.get("merged_into"):
        raise ValueError("Merged redirect projects cannot be split")
    source_meta.setdefault("slug", source_slug)
    snapshot = Path(tempfile.mkdtemp(prefix="builders-diary-split-"))
    try:
        shutil.copytree(source_dir, snapshot / "source")
        target_dir.mkdir(parents=True)
        new_id = f"p-{uuid.uuid4().hex[:8]}"
        target_meta = dict(source_meta)
        target_meta.update({"id": new_id, "slug": new_slug, "title": new_title.strip(), "name": new_title.strip()})
        target_meta.pop("merged_into", None)
        target_meta["source_refs"] = []
        write_json_atomic(target_dir / "project.json", target_meta)

        found_ids: set[str] = set()
        found_refs: set[str] = set()
        matched_refs: set[str] = set()
        moved = 0
        for purpose_dir in sorted(source_dir.iterdir()):
            if not purpose_dir.is_dir() or purpose_dir.name.startswith("."):
                continue
            goal_path = purpose_dir / "goal.json"
            if not goal_path.is_file():
                raise ValueError(f"Purpose is missing goal.json: {purpose_dir.name}")
            goal = _read(goal_path)
            goal.setdefault("slug", purpose_dir.name)
            goal.setdefault("id", f"goal-{purpose_dir.name}")
            selected: list[tuple[Path, dict[str, Any]]] = []
            for task_dir in sorted(purpose_dir.iterdir()):
                if not task_dir.is_dir() or task_dir.name.startswith("."):
                    continue
                record_path = task_dir / "record.json"
                if not record_path.is_file():
                    raise ValueError(f"Task is missing record.json: {task_dir.name}")
                record = _read(record_path)
                record_id = str(record.get("id") or "")
                record_refs = {item for item in record.get("source_refs", []) if isinstance(item, str)}
                if record_id in selected_ids or record_refs.intersection(selected_refs):
                    selected.append((task_dir, record))
                    if record_id:
                        found_ids.add(record_id)
                    found_refs.update(record_refs)
                    matched_refs.update(record_refs.intersection(selected_refs))
            if not selected:
                continue
            target_purpose = target_dir / purpose_dir.name
            target_purpose.mkdir(parents=True, exist_ok=True)
            goal["project_slug"] = new_slug
            write_json_atomic(target_purpose / "goal.json", goal)
            for task_dir, record in selected:
                destination = target_purpose / task_dir.name
                if destination.exists():
                    raise ValueError(f"Task destination already exists: {task_dir.name}")
                shutil.move(str(task_dir), str(destination))
                _rewrite_record(destination / "record.json", target_meta, goal, destination.name)
                moved += 1
            if not any(item.is_dir() for item in purpose_dir.iterdir()):
                shutil.rmtree(purpose_dir)

        missing_ids = selected_ids - found_ids
        if missing_ids:
            raise ValueError(f"Selected task ID does not exist: {sorted(missing_ids)[0]}")
        if selected_refs and not matched_refs:
            raise ValueError("Selected source refs do not exist")
        target_meta["source_refs"] = sorted(found_refs)
        write_json_atomic(target_dir / "project.json", target_meta)
        return {
            "status": "applied", "source_slug": source_slug, "new_slug": new_slug,
            "new_project_id": new_id, "moved_task_ids": sorted(found_ids), "source_refs": sorted(found_refs),
            "moved_tasks": moved,
        }
    except Exception:
        if target_dir.exists():
            shutil.rmtree(target_dir)
        if source_dir.exists():
            shutil.rmtree(source_dir)
        shutil.copytree(snapshot / "source", source_dir)
        raise
    finally:
        shutil.rmtree(snapshot, ignore_errors=True)
