"""Shared, versioned envelopes for local Builder's Diary web actions."""
from __future__ import annotations

import datetime as dt
import json
import os
import tempfile
import uuid
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1
ALLOWED_ACTIONS = {"project.confirm", "task.approve"}
RESULT_STATUSES = {"applied", "rejected", "error", "timeout"}
_ENVELOPE_KEYS = {"schema_version", "action_id", "action", "run_id", "created_at", "payload"}
_RESULT_KEYS = {"schema_version", "action_id", "status", "applied_at", "result", "error"}


def _timestamp(value: Any, field: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} must be an ISO-8601 timestamp")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"{field} must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        raise ValueError(f"{field} must include a timezone")
    return value


def _check_action_name(action: Any) -> None:
    if action not in ALLOWED_ACTIONS:
        raise ValueError("Unsupported web action")


def _validate_payload(action: Any, payload: Any) -> None:
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")
    expected = {"projects"} if action == "project.confirm" else {"task"}
    if set(payload) != expected:
        raise ValueError(f"{action} payload has invalid fields")
    if not isinstance(payload[next(iter(expected))], (list if action == "project.confirm" else dict)):
        raise ValueError(f"{action} payload has invalid fields")


def create_action(action: str, run_id: str, payload: dict[str, Any], *, action_id: str | None = None, created_at: str | None = None) -> dict[str, Any]:
    """Build and validate a new action envelope."""
    _check_action_name(action)
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")
    envelope = {
        "schema_version": SCHEMA_VERSION,
        "action_id": action_id or str(uuid.uuid4()),
        "action": action,
        "run_id": run_id,
        "created_at": created_at or dt.datetime.now(dt.timezone.utc).isoformat(),
        "payload": payload,
    }
    return validate_action(envelope, run_id=run_id)


def validate_action(action: Any, *, run_id: str, action_name: str | None = None, allow_legacy: bool = False) -> dict[str, Any]:
    """Validate an action and return its canonical envelope.

    Legacy v0 files are accepted only when explicitly requested by the helper;
    their payload is the action-specific field(s), and their ID is deterministic
    so replay remains safe during the compatibility release.
    """
    if not isinstance(action, dict):
        raise ValueError("Action must be an object")
    is_legacy = "schema_version" not in action
    if is_legacy:
        if not allow_legacy:
            raise ValueError("Unsupported action schema_version")
        name = action.get("action")
        _check_action_name(name)
        if action.get("run_id") != run_id:
            raise ValueError("Action run_id does not match")
        payload = {key: value for key, value in action.items() if key not in {"action", "run_id"}}
        canonical = {
            "schema_version": SCHEMA_VERSION,
            "action_id": str(uuid.uuid5(uuid.NAMESPACE_URL, json.dumps(action, sort_keys=True, separators=(",", ":")))),
            "action": name,
            "run_id": run_id,
            "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "payload": payload,
        }
        _validate_payload(name, payload)
    else:
        if set(action) != _ENVELOPE_KEYS:
            raise ValueError("Action envelope has invalid top-level keys")
        if action.get("schema_version") != SCHEMA_VERSION:
            raise ValueError("Unsupported action schema_version")
        try:
            uuid.UUID(str(action.get("action_id")))
        except (ValueError, TypeError, AttributeError) as exc:
            raise ValueError("action_id must be a UUID") from exc
        if action.get("run_id") != run_id:
            raise ValueError("Action run_id does not match")
        _timestamp(action.get("created_at"), "created_at")
        _check_action_name(action.get("action"))
        if not isinstance(action.get("payload"), dict):
            raise ValueError("payload must be an object")
        _validate_payload(action["action"], action["payload"])
        canonical = dict(action)
    if action_name is not None:
        _check_action_name(action_name)
        if canonical["action"] != action_name:
            raise ValueError("Action name does not match requested action")
    return canonical


def create_result(action_id: str, status: str, result: dict[str, Any] | None = None, error: str | None = None, *, applied_at: str | None = None) -> dict[str, Any]:
    if status not in RESULT_STATUSES:
        raise ValueError("Unsupported result status")
    try:
        uuid.UUID(str(action_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValueError("action_id must be a UUID") from exc
    if result is not None and not isinstance(result, dict):
        raise ValueError("result must be an object")
    if error is not None and not isinstance(error, str):
        raise ValueError("error must be text or null")
    return {"schema_version": SCHEMA_VERSION, "action_id": action_id, "status": status,
            "applied_at": applied_at or dt.datetime.now(dt.timezone.utc).isoformat(),
            "result": result or {}, "error": error}


def write_json_atomic(path: str | Path, value: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def read_action(path: str | Path, *, run_id: str, action_name: str) -> dict[str, Any]:
    _check_action_name(action_name)
    try:
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise FileNotFoundError(f"Web action not ready: {action_name}") from exc
    return validate_action(raw, run_id=run_id, action_name=action_name, allow_legacy=True)
