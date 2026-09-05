#!/usr/bin/env python3
"""
Builder's Diary — record saver.

Creates/updates the local store with the EXACT schema the web UI reads:
  {ROOT}/{project-slug}/project.json
  {ROOT}/{project-slug}/{goal-slug}/goal.json
  {ROOT}/{project-slug}/{goal-slug}/{YYYYMMDD}-{seq}-{title-slug}/record.json

ROOT = $BUILDERS_DIARY_PATH or ~/builders-diary

Existing project/goal folders are REUSED (their id is kept); only new ones get a fresh id.
No external dependencies — Python 3 stdlib only.

Usage:
  save_record.py \
    --project "JobSpy" \
    --goal "Supabase egress fix" \
    --title "Found why the overage came back" \
    --tags "observability,cost-analysis,supabase" \
    --body-file /tmp/body.md

  # body can also come from stdin:
  echo "## What..." | save_record.py --project P --goal G --title T --tags a,b

Prints a JSON summary of what was written to stdout.
"""

import argparse
import datetime as _dt
import json
import os
import re
import sys
import uuid


# Work categories — replace PM-style status. Shows the builder's range at a glance.
CATEGORIES = ["Planning", "Design", "Engineering", "Research", "Growth"]


def default_root() -> str:
    """Data root shared with the web app and npx installer:
    ~/Documents/builders-diary when ~/Documents exists (typical desktop OS),
    else ~/builders-diary."""
    docs = os.path.expanduser("~/Documents")
    base = docs if os.path.isdir(docs) else os.path.expanduser("~")
    return os.path.join(base, "builders-diary")

# Evidence types — generalized to cover non-developer work, not just code.
#   input    → what the builder started with (interview transcript, error log, brief)
#   judgment → an AI-proposed option the builder rejected/changed, and why
#   quote    → a verbatim line from source material or tool output
#   artifact → a produced thing with a link (commit, PR, deploy URL, screenshot, doc)
EVIDENCE_TYPES = ["input", "judgment", "quote", "artifact"]


def now_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


def today_stamp() -> str:
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%d")


def slugify(text: str) -> str:
    """Lowercase, spaces->hyphens, keep unicode word chars (incl. Korean), drop punctuation."""
    text = (text or "").strip().lower()
    # Replace any run of whitespace/underscore with a single hyphen
    text = re.sub(r"[\s_]+", "-", text)
    # Drop characters that are not word chars or hyphens (unicode-aware)
    text = re.sub(r"[^\w\-]", "", text, flags=re.UNICODE)
    # Collapse multiple hyphens
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text or "untitled"


def short_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def load_json(path: str):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def write_json(path: str, data: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def ensure_project(root: str, title: str) -> dict:
    slug = slugify(title)
    pdir = os.path.join(root, slug)
    pjson = os.path.join(pdir, "project.json")
    existing = load_json(pjson)
    if existing and existing.get("id"):
        return existing
    meta = {
        "id": short_id("p"),
        "slug": slug,
        "title": title,
        "created_at": now_iso(),
        "share_id": None,
    }
    write_json(pjson, meta)
    return meta


def ensure_goal(root: str, project: dict, title: str) -> dict:
    slug = slugify(title)
    gdir = os.path.join(root, project["slug"], slug)
    gjson = os.path.join(gdir, "goal.json")
    existing = load_json(gjson)
    if existing and existing.get("id"):
        return existing
    meta = {
        "id": short_id("g"),
        "slug": slug,
        "title": title,
        "project_slug": project["slug"],
        "created_at": now_iso(),
        "share_id": None,
    }
    write_json(gjson, meta)
    return meta


def next_seq(goal_dir: str) -> int:
    """Count existing record folders (YYYYMMDD-NNN-...) to pick the next sequence number."""
    if not os.path.isdir(goal_dir):
        return 0
    count = 0
    for name in os.listdir(goal_dir):
        full = os.path.join(goal_dir, name)
        if os.path.isdir(full) and re.match(r"^\d{8}-\d{3}-", name):
            count += 1
    return count


def main() -> int:
    ap = argparse.ArgumentParser(description="Save a Builder's Diary work record.")
    ap.add_argument("--project", required=True, help="Project title")
    ap.add_argument("--goal", required=True, help="Goal title")
    ap.add_argument("--title", required=True, help="Record title")
    ap.add_argument("--tags", default="", help="Comma-separated tags")
    ap.add_argument("--body-file", help="Path to markdown body file (else read stdin)")
    ap.add_argument("--root", help="Store root (default: $BUILDERS_DIARY_PATH or ~/builders-diary)")
    ap.add_argument("--category", default="", choices=["", *CATEGORIES],
                    help=f"Work category, one of: {', '.join(CATEGORIES)}")
    ap.add_argument("--judgment", default="",
                    help="The judgment call: what the AI proposed and what the builder "
                         "rejected/changed and why. The most valuable field — leave empty "
                         "only if the session had no real human judgment moment.")
    ap.add_argument("--evidence-file", help="Path to a JSON file: a list of evidence items "
                    "(each {type, label, ...}). type ∈ input|judgment|quote|artifact.")
    args = ap.parse_args()

    root = (
        args.root
        or os.environ.get("BUILDERS_DIARY_PATH")
        or default_root()
    )
    root = os.path.expanduser(root)

    # Body: from file or stdin
    if args.body_file:
        with open(args.body_file, "r", encoding="utf-8") as f:
            body = f.read()
    elif not sys.stdin.isatty():
        body = sys.stdin.read()
    else:
        body = ""

    tags = [t.strip() for t in args.tags.split(",") if t.strip()]

    # Evidence: optional JSON list
    evidence = []
    if args.evidence_file:
        try:
            with open(args.evidence_file, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            if isinstance(loaded, list):
                evidence = [e for e in loaded if isinstance(e, dict) and e.get("type") in EVIDENCE_TYPES]
        except (OSError, json.JSONDecodeError):
            evidence = []

    project = ensure_project(root, args.project)
    goal = ensure_goal(root, project, args.goal)

    goal_dir = os.path.join(root, project["slug"], goal["slug"])
    seq = next_seq(goal_dir)
    folder = f"{today_stamp()}-{seq:03d}-{slugify(args.title)}"
    rec_dir = os.path.join(goal_dir, folder)
    rec_path = os.path.join(rec_dir, "record.json")

    ts = now_iso()
    record = {
        "id": short_id("r"),
        "folder": folder,
        "title": args.title,
        "category": args.category or None,
        "tags": tags,
        "body": body,
        "judgment": args.judgment or None,
        "evidence": evidence,
        "project_id": project["id"],
        "project_slug": project["slug"],
        "project_title": project["title"],
        "goal_id": goal["id"],
        "goal_slug": goal["slug"],
        "goal_title": goal["title"],
        "created_at": ts,
        "updated_at": ts,
        "share_id": None,
        "path": rec_dir,
    }
    write_json(rec_path, record)

    print(json.dumps({
        "ok": True,
        "record_id": record["id"],
        "path": rec_path,
        "project": project["title"],
        "goal": goal["title"],
        "title": record["title"],
        "category": record["category"],
        "tags": tags,
        "has_judgment": bool(record["judgment"]),
        "evidence_count": len(evidence),
        "seq": seq,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
