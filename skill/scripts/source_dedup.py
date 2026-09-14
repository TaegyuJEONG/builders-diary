"""Cross-client source identity, exact deduplication, and review-only similarity."""
from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from typing import Any


def _text(value: Any) -> str:
    if isinstance(value, str):
        return re.sub(r"\s+", " ", value).strip().lower()
    if isinstance(value, (list, tuple)):
        return " ".join(_text(item) for item in value)
    if isinstance(value, dict):
        return " ".join(f"{_text(key)}:{_text(value[key])}" for key in sorted(value))
    return "" if value is None else str(value).strip().lower()


def _hash(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def normalize_source(source: dict[str, Any]) -> dict[str, Any]:
    """Return stable identity plus a content hash with client/path noise removed."""
    client = _text(source.get("client") or source.get("source_client") or source.get("kind"))
    source_id = str(source.get("source_id") or "").strip()
    if not client or not source_id:
        raise ValueError("A source needs a stable client and source_id")
    source_ref = str(source.get("source_ref") or f"{client}:{source_id}").strip()
    content = source.get("content")
    if content is None:
        content = {key: source.get(key) for key in (
            "title", "name", "summary", "first_prompt", "last_prompt", "created_at", "updated_at", "message_count",
        )}
    content_hash = _hash(_text(content))
    return {"source_ref": source_ref, "client": client, "source_id": source_id,
            "content_hash": content_hash, "fingerprint": _hash({"source_ref": source_ref, "content_hash": content_hash})}


def _tokens(source: dict[str, Any]) -> set[str]:
    text = " ".join(_text(source.get(key)) for key in ("title", "name", "summary", "first_prompt", "content"))
    return set(re.findall(r"[a-z0-9]{3,}", text))


def deduplicate_sources(sources: list[dict[str, Any]], similarity_threshold: float = 0.65) -> dict[str, Any]:
    """Collapse exact content duplicates; return semantic matches as review candidates only."""
    normalized = [normalize_source(source) for source in sources]
    by_hash: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in normalized:
        by_hash[item["content_hash"]].append(item)
    exact_duplicates = []
    unique = []
    canonical_by_ref = {}
    for group in by_hash.values():
        canonical = group[0]
        unique.append(canonical["source_ref"])
        canonical_by_ref[canonical["source_ref"]] = canonical["source_ref"]
        duplicates = [item["source_ref"] for item in group[1:]]
        for duplicate in duplicates:
            canonical_by_ref[duplicate] = canonical["source_ref"]
        if duplicates:
            exact_duplicates.append({"canonical_source_ref": canonical["source_ref"], "duplicate_source_refs": duplicates})
    merge_candidates = []
    for index, left in enumerate(sources):
        for right in sources[index + 1:]:
            a, b = normalize_source(left), normalize_source(right)
            if a["content_hash"] == b["content_hash"]:
                continue
            left_tokens, right_tokens = _tokens(left), _tokens(right)
            score = len(left_tokens & right_tokens) / len(left_tokens | right_tokens) if left_tokens and right_tokens else 0.0
            if score >= similarity_threshold:
                merge_candidates.append({"source_refs": [a["source_ref"], b["source_ref"]], "score": round(score, 3), "status": "candidate"})
    return {"schema_version": 1, "unique_sources": unique, "canonical_by_ref": canonical_by_ref,
            "exact_duplicates": exact_duplicates, "merge_candidates": merge_candidates}
