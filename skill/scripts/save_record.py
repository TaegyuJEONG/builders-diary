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


# Work categories — legacy (v2). Kept for --category back-compat mapping to section.
CATEGORIES = ["Planning", "Design", "Engineering", "Research", "Growth"]

# Builder-lifecycle sections (v3). The section is the process spine + cross-project axis.
SECTIONS = ["Think", "Plan", "Build", "Review", "Test", "Ship", "Reflect"]

# Task progress (v3) — builder-facing, not PM done/blocked status.
PROGRESS = ["done", "ongoing", "dropped", "undecided"]

# Map legacy category → nearest lifecycle section (best-effort back-compat).
CATEGORY_TO_SECTION = {
    "Planning": "Plan",
    "Design": "Build",
    "Engineering": "Build",
    "Research": "Think",
    "Growth": "Ship",
}


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


def build_highlight(args):
    """Structured highlight {ai, builder, why} — the AI-vs-builder contrast.
    Accepts new --highlight-* flags, legacy --judgment-* flags, or a single
    legacy --judgment string. Returns dict, string, or None. Web accepts all."""
    ai = (getattr(args, "highlight_ai", "") or getattr(args, "judgment_ai", "") or "").strip()
    builder = (getattr(args, "highlight_builder", "") or getattr(args, "judgment_builder", "") or "").strip()
    why = (getattr(args, "highlight_why", "") or getattr(args, "judgment_why", "") or "").strip()
    if ai or builder or why:
        j = {}
        if ai:
            j["ai"] = ai
        if builder:
            j["builder"] = builder
        if why:
            j["why"] = why
        return j
    return args.judgment or None


def today_stamp() -> str:
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%d")


def today_stamp_iso() -> str:
    """YYYY-MM-DD for the record's display date field."""
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d")


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


def ensure_project(root: str, title: str, extra: "dict | None" = None) -> dict:
    """Create or reuse a project. `extra` may carry sector/one_liner/logo/role;
    on an existing project, non-empty extra fields update it (keeps id/slug)."""
    slug = slugify(title)
    pdir = os.path.join(root, slug)
    pjson = os.path.join(pdir, "project.json")
    existing = load_json(pjson)
    extra = {k: v for k, v in (extra or {}).items() if v}
    if existing and existing.get("id"):
        if extra:
            existing.update(extra)
            existing["updated_at"] = now_iso()
            write_json(pjson, existing)
        return existing
    meta = {
        "id": short_id("p"),
        "slug": slug,
        "title": title,
        "name": title,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "share_id": None,
    }
    meta.update(extra)
    write_json(pjson, meta)
    return meta


def ensure_section(root: str, project: dict, title: str, stage: str = "", order: "int | None" = None) -> dict:
    """Create or reuse a section (stored on disk as goal.json for back-compat).
    `stage` is the lifecycle stage (Think/Plan/Build/...); `title` is the folder key."""
    slug = slugify(title)
    gdir = os.path.join(root, project["slug"], slug)
    gjson = os.path.join(gdir, "goal.json")
    existing = load_json(gjson)
    if existing and existing.get("id"):
        changed = False
        if stage and existing.get("stage") != stage:
            existing["stage"] = stage
            changed = True
        if changed:
            existing["updated_at"] = now_iso()
            write_json(gjson, existing)
        return existing
    meta = {
        "id": short_id("g"),
        "slug": slug,
        "title": title,
        "stage": stage or title,
        "project_slug": project["slug"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "share_id": None,
    }
    if order is not None:
        meta["order"] = order
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


def list_projects(root: str) -> list:
    """Scan the store and return [{slug, name, sector, role, sections:[{stage,title,tasks}]}].
    Used by the skill's Step 1 (new vs existing project)."""
    out = []
    if not os.path.isdir(root):
        return out
    for pslug in sorted(os.listdir(root)):
        pdir = os.path.join(root, pslug)
        pjson = os.path.join(pdir, "project.json")
        if pslug.startswith(".") or not os.path.isfile(pjson):
            continue
        p = load_json(pjson) or {}
        sections = []
        for gslug in sorted(os.listdir(pdir)):
            gdir = os.path.join(pdir, gslug)
            gjson = os.path.join(gdir, "goal.json")
            if gslug.startswith(".") or not os.path.isfile(gjson):
                continue
            g = load_json(gjson) or {}
            stage = g.get("stage")
            if stage:
                sections.append({
                    "stage": stage,
                    "title": g.get("title") or gslug,
                    "tasks": next_seq(gdir),
                })
            else:
                # Legacy goal folders may contain multiple old categories.
                # Infer lifecycle sections from their record metadata without
                # moving files on disk.
                inferred = {}
                for name in os.listdir(gdir):
                    rpath = os.path.join(gdir, name, "record.json")
                    if not os.path.isfile(rpath):
                        continue
                    r = load_json(rpath) or {}
                    stage_name = r.get("section") or CATEGORY_TO_SECTION.get(r.get("category", ""))
                    if stage_name:
                        inferred[stage_name] = inferred.get(stage_name, 0) + 1
                if inferred:
                    for stage_name, tasks in sorted(inferred.items()):
                        sections.append({"stage": stage_name, "title": stage_name, "tasks": tasks})
                else:
                    sections.append({
                        "stage": g.get("title") or gslug,
                        "title": g.get("title") or gslug,
                        "tasks": next_seq(gdir),
                    })
        out.append({
            "slug": p.get("slug", pslug),
            "name": p.get("name") or p.get("title") or pslug,
            "sector": p.get("sector"),
            "role": p.get("role"),
            "sections": sections,
        })
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Save a Builder's Diary work record.")
    ap.add_argument("--list-projects", action="store_true",
                    help="Print existing projects (+sections) as JSON and exit. For skill Step 1.")
    ap.add_argument("--root", help="Store root (default: $BUILDERS_DIARY_PATH or ~/Documents/builders-diary)")

    ap.add_argument("--project", help="Project title")
    # Project metadata (optional; written on create, updated on reuse if provided)
    ap.add_argument("--sector", default="", help="Project sector, e.g. 'Marketplace SaaS'")
    ap.add_argument("--one-liner", default="", help="Project one-line description")
    ap.add_argument("--role", default="", help="Builder's role, e.g. 'Zero-to-One'")
    ap.add_argument("--logo", default="", help="Optional logo path (else UI shows an initial badge)")

    # Section (lifecycle stage). --goal kept as an alias for back-compat.
    ap.add_argument("--section", default="", help=f"Lifecycle stage: {', '.join(SECTIONS)} (custom allowed)")
    ap.add_argument("--goal", default="", help="Alias for --section (legacy)")

    ap.add_argument("--title", help="Task title")
    ap.add_argument("--sub-purpose", default="", help="The specific aim of this task, one line")
    ap.add_argument("--tags", default="", help="Comma-separated tags")
    ap.add_argument("--tools", default="", help="Comma-separated AI tools/stacks used")
    ap.add_argument("--mindset", default="", help="Comma-separated mindset tags (skeptical, cost-aware…)")
    ap.add_argument("--progress", default="", choices=["", *PROGRESS],
                    help=f"Task progress: {', '.join(PROGRESS)}")
    ap.add_argument("--body-file", help="Path to markdown body file (else read stdin)")

    # Legacy category (v2) — maps to a section when --section is absent.
    ap.add_argument("--category", default="", choices=["", *CATEGORIES], help="Legacy; maps to a section")

    # Highlight (v3) = the AI-vs-builder contrast. Legacy --judgment* still accepted.
    ap.add_argument("--highlight-ai", default="", help="What the AI proposed, near-verbatim")
    ap.add_argument("--highlight-builder", default="", help="What the builder decided")
    ap.add_argument("--highlight-why", default="", help="The builder's reasoning, one line")
    ap.add_argument("--judgment", default="", help="Legacy single-string highlight")
    ap.add_argument("--judgment-ai", default="", help="Legacy alias for --highlight-ai")
    ap.add_argument("--judgment-builder", default="", help="Legacy alias for --highlight-builder")
    ap.add_argument("--judgment-why", default="", help="Legacy alias for --highlight-why")

    ap.add_argument("--evidence-file", help="Path to a JSON file: list of evidence items "
                    "(each {type, label, ...}). type ∈ input|judgment|quote|artifact.")
    args = ap.parse_args()

    root = (
        args.root
        or os.environ.get("BUILDERS_DIARY_PATH")
        or default_root()
    )
    root = os.path.expanduser(root)

    # --list-projects: print and exit (skill Step 1)
    if args.list_projects:
        print(json.dumps(list_projects(root), ensure_ascii=False, indent=2))
        return 0

    # Saving a record requires project + section + title
    section_title = args.section or args.goal or (
        CATEGORY_TO_SECTION.get(args.category, args.category) if args.category else "")
    if not args.project or not args.title or not section_title:
        ap.error("saving a record requires --project, --title, and --section (or --goal/--category)")

    # Body: from file or stdin
    if args.body_file:
        with open(args.body_file, "r", encoding="utf-8") as f:
            body = f.read()
    elif not sys.stdin.isatty():
        body = sys.stdin.read()
    else:
        body = ""

    tags = [t.strip() for t in args.tags.split(",") if t.strip()]
    tools = [t.strip() for t in args.tools.split(",") if t.strip()]
    mindset = [m.strip() for m in args.mindset.split(",") if m.strip()]

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

    project = ensure_project(root, args.project, extra={
        "sector": args.sector, "one_liner": args.one_liner,
        "role": args.role, "logo": args.logo,
    })
    # Section stored on disk as goal.json (back-compat). order = lifecycle index when known.
    stage = section_title
    order = SECTIONS.index(stage) if stage in SECTIONS else None
    section = ensure_section(root, project, stage, stage=stage, order=order)

    section_dir = os.path.join(root, project["slug"], section["slug"])
    seq = next_seq(section_dir)
    folder = f"{today_stamp()}-{seq:03d}-{slugify(args.title)}"
    rec_dir = os.path.join(section_dir, folder)
    rec_path = os.path.join(rec_dir, "record.json")

    highlight = build_highlight(args)
    ts = now_iso()
    record = {
        "id": short_id("r"),
        "folder": folder,
        "title": args.title,
        "date": today_stamp_iso(),
        "section": stage,
        "sub_purpose": args.sub_purpose or None,
        "tags": tags,
        "tools": tools,
        "mindset": mindset,
        "progress": args.progress or None,
        # v3 narrative field + legacy `body` dual-write (one release) so old web builds keep working
        "body_md": body,
        "body": body,
        # v3 `highlight` + legacy `judgment` dual-write
        "highlight": highlight,
        "judgment": highlight,
        # legacy category kept if passed (web maps section→display now)
        "category": args.category or None,
        "evidence": evidence,
        "project_id": project["id"],
        "project_slug": project["slug"],
        "project_title": project.get("title") or project.get("name"),
        "goal_id": section["id"],
        "goal_slug": section["slug"],
        "goal_title": section.get("title"),
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
        "project": project.get("title") or project.get("name"),
        "section": stage,
        "title": record["title"],
        "progress": record["progress"],
        "tools": tools,
        "has_highlight": bool(highlight),
        "evidence_count": len(evidence),
        "seq": seq,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
