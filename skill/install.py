#!/usr/bin/env python3
"""
Builder's Diary — skill installer.

Copies SKILL.md + scripts/ into each selected AI tool's skills directory.
No MCP, no config editing — a skill is just files in the right folder.

Usage:
  install.py --tools claude,cursor
  install.py --tools claude --dry-run
  install.py --list                 # show supported tools + resolved paths

Supported tools and their skills directories:
  claude   → ~/.claude/skills/builders-diary/
  cursor   → ~/.cursor/skills/builders-diary/
  windsurf → ~/.codeium/windsurf/skills/builders-diary/
  codex    → ~/.codex/skills/builders-diary/

Run from the skill source directory (the folder containing SKILL.md and scripts/).
Prints a summary of what was copied.
"""

import argparse
import os
import shutil
import sys

# tool id → skills directory (parent that will contain builders-diary/)
TOOL_DIRS = {
    "claude":   "~/.claude/skills",
    "cursor":   "~/.cursor/skills",
    "windsurf": "~/.codeium/windsurf/skills",
    "codex":    "~/.codex/skills",
}

SKILL_NAME = "builders-diary"
# Files/dirs that make up the skill (relative to source dir)
PAYLOAD = ["SKILL.md", "scripts"]


def source_dir() -> str:
    """The directory this installer lives in = the skill source."""
    return os.path.dirname(os.path.abspath(__file__))


def resolve(path: str) -> str:
    return os.path.expanduser(path)


def validate_source(src: str) -> list:
    missing = [p for p in PAYLOAD if not os.path.exists(os.path.join(src, p))]
    return missing


def install_one(src: str, tool: str, dry_run: bool) -> dict:
    parent = resolve(TOOL_DIRS[tool])
    dest = os.path.join(parent, SKILL_NAME)
    actions = []

    for item in PAYLOAD:
        s = os.path.join(src, item)
        d = os.path.join(dest, item)
        verb = "would copy" if dry_run else "copied"
        actions.append(f"{verb} {item} → {d.replace(os.path.expanduser('~'), '~')}")

        if dry_run:
            continue

        os.makedirs(dest, exist_ok=True)
        if os.path.isdir(s):
            if os.path.exists(d):
                shutil.rmtree(d)
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)

    # Ensure scripts stay executable
    if not dry_run:
        script = os.path.join(dest, "scripts", "save_record.py")
        if os.path.exists(script):
            os.chmod(script, 0o755)

    return {"tool": tool, "dest": dest, "actions": actions}


def main() -> int:
    ap = argparse.ArgumentParser(description="Install the Builder's Diary skill.")
    ap.add_argument("--tools", default="claude",
                    help="Comma-separated tool ids (claude,cursor,windsurf,codex)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Show what would be copied without writing")
    ap.add_argument("--list", action="store_true",
                    help="List supported tools and their resolved skill paths")
    args = ap.parse_args()

    if args.list:
        print("Supported tools:")
        for t, p in TOOL_DIRS.items():
            # tool is "installed" if its config root (parent of /skills) exists
            config_root = os.path.dirname(resolve(p))
            marker = "✓" if os.path.isdir(config_root) else " "
            print(f"  [{marker}] {t:9s} → {p}/{SKILL_NAME}/")
        print("\n  ✓ = the tool's config dir exists (tool likely installed)")
        return 0

    src = source_dir()
    missing = validate_source(src)
    if missing:
        print(f"ERROR: source dir {src} is missing: {', '.join(missing)}", file=sys.stderr)
        return 1

    tools = [t.strip() for t in args.tools.split(",") if t.strip()]
    unknown = [t for t in tools if t not in TOOL_DIRS]
    if unknown:
        print(f"ERROR: unknown tool(s): {', '.join(unknown)}", file=sys.stderr)
        print(f"Supported: {', '.join(TOOL_DIRS)}", file=sys.stderr)
        return 1

    mode = "DRY RUN — nothing written" if args.dry_run else "installing"
    print(f"Builder's Diary skill — {mode}")
    print(f"Source: {src}\n")

    for tool in tools:
        result = install_one(src, tool, args.dry_run)
        print(f"[{tool}]")
        for a in result["actions"]:
            print(f"  {a}")
        print()

    if args.dry_run:
        print("Re-run without --dry-run to install.")
    else:
        print("Done. Restart your AI tool, then type @builders-diary at the end of a session.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
