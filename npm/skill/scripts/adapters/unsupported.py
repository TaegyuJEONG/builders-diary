"""Explicit blocked result for clients whose history format is unverified."""
from __future__ import annotations

from .base import SourceContent


class UnsupportedClientAdapter:
    def __init__(self, client_id: str):
        self.client_id = client_id

    def discover(self) -> list:
        return []

    def discover_result(self) -> dict[str, str]:
        return {"client": self.client_id, "status": "blocked", "reason": "No inspectable conversation-history fixture or verified format; explicit fixture request required."}

    def read(self, source_id: str) -> SourceContent:
        raise ValueError(f"Unsupported client history format: {self.client_id}")
