"""Normalized interfaces for local, read-only source adapters."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@dataclass(frozen=True)
class SourceMetadata:
    client: str
    kind: str
    source_id: str
    title: str = ""
    summary: str = ""
    timestamp: str | None = None
    workspace: str | None = None
    artifact_hints: tuple[str, ...] = ()
    raw_locator: str | None = None
    fingerprint: str = ""
    source_ref: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        value = {
            "client": self.client, "kind": self.kind, "source_id": self.source_id,
            "title": self.title, "summary": self.summary, "timestamp": self.timestamp,
            "workspace": self.workspace, "artifact_hints": list(self.artifact_hints),
            "raw_locator": self.raw_locator, "fingerprint": self.fingerprint,
            "source_ref": self.source_ref,
        }
        value.update(self.extra)
        return value


@dataclass(frozen=True)
class SourceContent:
    source_id: str
    content: Any


@runtime_checkable
class SourceAdapter(Protocol):
    client_id: str

    def discover(self) -> list[SourceMetadata]: ...

    def read(self, source_id: str) -> SourceContent: ...
