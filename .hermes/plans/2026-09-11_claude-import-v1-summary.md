# Claude Bulk Import — v1 Implementation Summary

## What was built

### 1. Local source scanner (`skill/scripts/claude_import.py`)

A read-only helper that:

- **Scans Claude Chat Export ZIPs** (conversations, projects, memories) without extracting one-time download URLs
- **Scans Claude Code local sessions** (`~/.claude/projects/`) including main JSONL files and workspace grouping
- **Creates a private import run index** under `$DATA_ROOT/imports/<run-id>/`
  - `manifest.json` — run metadata, counts, warnings, status
  - `source-index.json` — Chat + Code metadata
  - `project-candidates.json` — unified project proposals

**Privacy guarantees:**
- Never modifies source files
- Intentionally excludes `light_metadata` (account/login info)
- One-time export URLs are not printed to chat; instead creates a local HTML download page

**Commands:**
```bash
python3 claude_import.py download-page --manifest <path> --output <path>
python3 claude_import.py prepare --data-root <root> --export-dir <dir> --claude-config-dir <dir>
python3 claude_import.py confirm-project --data-root <root> --run-id <id> --name <name> --sector <sector> --one-liner <liner>
python3 claude_import.py confirm-purpose --data-root <root> --run-id <id> --project <name> --name <purpose> --stage <stage>
```

### 2. New IA: Project → Purpose (staged) → Task

**Before:** `Project → Section (lifecycle) → Task`
**After:** `Project → Purpose → Task`, where Purpose carries the primary lifecycle `stage`

**Why:** Purposes are reusable semantic workstreams (e.g. "Curation Taxonomy", "Market Validation") that can appear across projects. Lifecycle stages (Think/Plan/Build/Test/Ship) group purposes in the UI for recruiter-readable story flow.

**Compatibility:** `goal.json` remains the on-disk filename. Tasks inherit Purpose stage by default; rare task-level stage overrides are allowed.

**Changes:**
- `save_record.py` now accepts `--goal <Purpose> --stage <Stage>` (legacy `--section` still works)
- Web UI renamed "Goals" → "Purposes" in dropdowns, comments, and labels
- `expandGoalSections()` preserves Purpose title and only splits legacy multi-stage folders

### 3. Import onboarding skill (`import-skill/SKILL.md`)

Multi-turn guided workflow:

1. **Download Export ZIPs** — helper creates local HTML page with safe links; user clicks while logged in to Claude
2. **Prepare import run** — indexes Chat + Code sources, writes run manifest
3. **Propose & confirm Projects** — unified Chat Projects + Code workspaces; user approves each
4. **Propose & confirm Purposes** — staged workstreams grouped by lifecycle; user curates
5. **Process one source at a time** — split by intent, draft Task candidates, approve evidence, save cards

**Token:** `{{BUILDERS_DIARY_IMPORT_SCRIPT}}` bound by installer to the helper's absolute path

### 4. Web UI updates

**Import progress component** (`web/src/components/ImportProgress.tsx`):
- Displays active import runs (source, status, counts, warnings)
- Shows trigger prompt `/builders-diary-import` when Claude is selected
- Polls `imports/` folder for live updates while web view stays open

**Live refresh:**
- `home-content.tsx` polls `scanImportRuns()` every 3 seconds when connected
- New confirmed projects/purposes appear immediately

**Types:**
- Added `ImportRun` interface with `id`, `source`, `status`, `created_at`, `counts`, `warnings`
- `Goal` comment clarifies it's a Purpose stored as `goal.json` for compatibility

### 5. Installer changes (`npm/bin/cli.js`)

Now installs TWO skills for Claude Code:

- `~/.claude/skills/builders-diary/` — daily session recorder
- `~/.claude/skills/builders-diary-import/` — bulk import workflow

Dry-run output shows both.

### 6. Tests

**`tests/test_claude_import.py`:**
- `test_scan_export_returns_safe_metadata_and_ignores_light_metadata`
- `test_scan_code_sessions_reads_main_sessions_and_skips_subagents`
- `test_prepare_run_writes_only_import_state_and_keeps_sources_unchanged`
- `test_confirmed_project_and_purpose_materialize_into_portfolio_tree`
- `test_download_page_contains_only_download_categories`
- `test_installer_dry_run_includes_daily_and_import_skills`

**`tests/test_purpose_structure.py`:**
- `test_new_goal_and_stage_keep_purpose_distinct_from_task_aim`
- `test_legacy_section_only_call_keeps_existing_section_as_purpose`

All 8 tests pass.

**Build verification:**
- `npm pack --dry-run` confirms 8 files in package (SKILL.md, claude_import.py, import-skill/SKILL.md, etc.)
- `npm run build` completes with zero errors
- `npx tsc --noEmit` passes
- Dev server runs at http://localhost:3111 with demo data

## What works

✅ **Local source discovery** — reads Chat Export ZIPs + Code sessions without modifying sources  
✅ **Import run indexing** — writes manifest + source-index + project-candidates under `imports/<run-id>/`  
✅ **Purpose-based IA** — Project → Purpose (staged) → Task structure with backward-compatible `goal.json`  
✅ **Download page generation** — creates local HTML with safe export links (no URLs in chat)  
✅ **Web import progress UI** — displays runs, polls for updates, shows trigger prompt  
✅ **Dual-skill installer** — installs both `builders-diary` and `builders-diary-import` to Claude Code  
✅ **Tests + build** — 8 tests pass, package builds cleanly, TypeScript compiles

## What is NOT implemented (v1 limitations)

🔲 **Actual source analysis** — helper indexes metadata only; LLM-driven candidate splitting, Purpose inference, and Task card drafting belong in the skill's interactive turns, not the helper script  
🔲 **Auto-merge detection** — Chat Project + Code workspace merge proposals require LLM judgment; helper only lists candidates  
🔲 **Evidence extraction** — commits, tool calls, file changes, URLs are read from source but not yet transformed into Task evidence format  
🔲 **Cost/progress tracking** — no token estimates or progress bars for multi-session analysis  
🔲 **Cursor/Codex/Enterprise** — v1 supports only Claude Chat Export + Claude Code local sessions  
🔲 **Incremental re-import** — no deduplication against existing portfolio cards  
🔲 **Web onboarding flow** — user must invoke skill from AI chat; no standalone web wizard yet

## How to use (v1)

### Install

```bash
cd ~/work/builders-diary/npm
npm install -g .
# or: npx builders-diary install --tools claude
```

Confirms:
```
[claude]
  ~/.claude/skills/builders-diary/SKILL.md
  ~/.claude/skills/builders-diary/scripts/save_record.py
  ~/.claude/skills/builders-diary/scripts/claude_import.py
  
  [builders-diary-import]
    ~/.claude/skills/builders-diary-import/SKILL.md
```

### Trigger from Claude Code chat

```
/builders-diary-import
```

Or:

```
Import my past Claude work into Builder's Diary
```

The skill will:
1. Ask where you saved your Claude Export manifest JSON
2. Create a local download page and open it
3. Tell you to click 2-3 links (Conversations, Projects, optionally Memories) and save ZIPs
4. Index Chat + Code sources and propose projects
5. Let you confirm/edit/merge projects
6. Propose staged purposes for each project
7. Walk through source chats one by one, draft Task candidates, get approval, save cards

### Verified scope

**Source counts from actual developer export:**
- 188 Chat conversations
- 8 Chat projects
- 104 Claude Code sessions (16 main + 88 subagents)
- 11 Code workspaces

**Demo portfolio loaded:**
- 3 projects (Builder's Diary V2, Supabase Cost Optimisation, LLM Evaluation)
- 4 purposes (MCP Server Integration, State Management, Testing & Performance, UI Layout Redesign)
- 25 task cards across 4 lifecycle stages

## Files changed

**Core:**
- `skill/scripts/claude_import.py` (new, 373 lines)
- `skill/scripts/save_record.py` (Purpose + Stage support)
- `skill/SKILL.md` (updated IA: Purpose → Stage → Task)

**Import skill:**
- `import-skill/SKILL.md` (new, 209 lines)
- `npm/import-skill/SKILL.md` (packaged copy)
- `npm/skill/scripts/claude_import.py` (packaged copy)

**Installer:**
- `npm/bin/cli.js` (dual-skill install)
- `npm/package.json` (added import-skill files)

**Web:**
- `web/src/components/ImportProgress.tsx` (new)
- `web/src/lib/fileSystem.ts` (scanImportRuns, expandGoalSections fixes)
- `web/src/lib/types.ts` (ImportRun, Goal comment)
- `web/src/app/home-content.tsx` (import polling)
- `web/src/components/Header.tsx` ("Goals" → "Purposes")
- `web/src/components/ProjectSectionView.tsx` (PurposeStageBoard)

**Tests:**
- `tests/test_claude_import.py` (6 tests)
- `tests/test_purpose_structure.py` (2 tests)

## Next steps (out of scope for v1)

- **Implement LLM-driven candidate curation** — Purpose inference, intent splitting, Task card drafting
- **Evidence transformation** — map source tool calls/files/commits to Task evidence format
- **Cost/progress UI** — token estimates, progress bars, pausable multi-session runs
- **Cursor/Codex support** — adapt scanner for other AI client local storage
- **Incremental import** — dedupe against existing portfolio, resume interrupted runs
- **Web onboarding wizard** — standalone UI flow without requiring AI chat invocation
