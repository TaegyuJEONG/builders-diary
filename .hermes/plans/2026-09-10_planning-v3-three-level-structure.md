# Builder's Diary v3 — 3-Level Structure Implementation Plan

> **For the implementer:** This is a large refactor across skill + script + web. Work in the 5 phases below, in order, verifying each before moving on. The existing 4 Adevinta records (legacy `body` markdown) MUST keep rendering at every step — that is the regression gate.

**Goal:** Rebuild Builder's Diary around a 3-level structure — **Project → Section (builder lifecycle) → Task** — so a recruiter can see (1) that the builder ships with AI *daily*, (2) the *process* behind polished outputs (not just the highlight reel), and (3) cross-project competence by section and by tool (no per-project silos).

**Positioning (why this exists):** The existing portfolio (`~/Portfolio_Website`) shows only distilled outcomes — which AI can now generate for anyone. Builder's Diary is the *complementary* layer that proves the convergence process and the human judgment inside it. It does NOT replace the portfolio; it shows what the portfolio omits.

---

## Confirmed Decisions (2026-09-10, with taegyujeong)

1. **3 levels:** Project → **Section** → Task.
2. **Sections = builder lifecycle:** `Think → Plan → Build → Review → Test → Ship → Reflect`. Custom sections allowed. This replaces the old flat `category` field — the section IS the process stage, and it's the cross-project axis.
3. **Progress (not maturity):** each task has `done / ongoing / dropped / undecided`. Section boxes show a progress rollup (e.g. "Build: 3 done · 1 ongoing").
4. **Hybrid body:** fixed structured fields (tools, mindset, progress, evidence, highlight) + free-form markdown narrative (`body_md`). The narrative's H2 sections are chosen by the work type (architecture / outreach / design system…), mirroring how the real portfolio's "Approach" section flexes per project.
5. **Judgment → renamed `highlight`, still optional:** `{ai, builder, why}`. The AI-vs-builder contrast is the premium differentiator but never mandatory — a customer-interview task with no AI-override still stands on its STAR narrative.
6. **Evidence = trust layer, prefer to have:** skill auto-extracts from chat (files, quotes, URLs); if it can't find or is unsure, it ASKS the builder (accept / provide / decline). Builder-approved evidence, never fabricated.
7. **Multi-turn skill, 2-gate human-in-the-loop:** candidate list first (curate), then per-card body confirm (approve), only then save. Kills the "one-shot garbage dump" problem.
8. **In-session extraction only** (not external audit.jsonl parsing): the session agent already has the full conversation + generated/read artifacts in context. Cowork VM storage is ephemeral and device-split; the in-session agent is the reliable witness. Skill must explicitly use artifacts (files created/read, links, images) as raw material, not just chat text.
9. **Backward compatible:** legacy records (`body` markdown string + `judgment` string|object, flat `category`) must keep rendering. Scanner maps old → new on read.

### Parked (v-next, do NOT build now)
- Web-based visual editing of records (edit skill output in the browser). Powerful, but scope explosion. Build the 3-level view first, add the edit layer after.

---

## Final Schema (v3)

### project.json — absorbs the real portfolio's header
```json
{
  "id": "p-xxx", "slug": "adevinta-ai-house-eir",
  "name": "Adevinta AI House EiR",
  "sector": "Marketplace SaaS",
  "one_liner": "AI-native operating setup pitched into a marketplace EiR role",
  "logo": null,                 // optional path; null → initial badge in UI
  "role": "Zero-to-One",        // strong identity field from the real portfolio
  "tags": ["AI", "Marketplace", "B2C"],
  "created_at": "...", "updated_at": "..."
}
```

### section.json (was goal.json) — the lifecycle stage = cross-project axis
```json
{
  "id": "s-xxx", "slug": "think",
  "stage": "Think",             // Think|Plan|Build|Review|Test|Ship|Reflect, or custom
  "title": "Reframe the pitch positioning",   // optional, what this stage did here
  "order": 0,                   // lifecycle order for stable section-box layout
  "created_at": "...", "updated_at": "..."
}
```
- Normalized `stage` set enables cross-project aggregation ("all Research", "all Build").
- Filename stays `goal.json` on disk for backward-compat OR migrate to `section.json` — see Phase 3 decision note.

### record.json (task card) — hybrid: fixed fields + flexible markdown
```json
{
  "id": "r-xxx", "folder": "20260906-000-slug", "title": "...",
  "date": "2026-09-06",
  "section": "Think",                            // denormalized for fast card render
  "sub_purpose": "Reframe email from tool-intro to running-evidence",
  "tools": ["Hermes", "GStack", "Claude Code"],  // cross-project tool axis
  "mindset": ["skeptical", "positioning"],        // discovery tags
  "progress": "done",                             // done|ongoing|dropped|undecided
  "highlight": { "ai": "...", "builder": "...", "why": "..." },  // optional premium layer
  "evidence": [ { "type": "input|quote|artifact|judgment", "label": "...", "url": "...", "meta": "...", "quote": "...", "detail": "..." } ],
  "body_md": "## Context\n...\n## How it converged\n...\n## Result\n...",  // flexible narrative
  "project_id": "...", "project_slug": "...", "project_title": "...",
  "goal_id": "...", "goal_slug": "...", "goal_title": "...",
  "created_at": "...", "updated_at": "...", "share_id": null, "path": "..."
}
```

### Backward-compat read rules (scanner)
- `section`: use `record.section` else `goal.stage` else legacy `category` else "Build".
- narrative: use `body_md` else parse legacy `body` markdown by H2 headers into named sections; if no H2, show `body` whole. **This fixes the PURPOSE=WORK duplication + raw `##` bug on the 4 Adevinta cards.**
- `highlight`: use `record.highlight` else legacy `judgment` (string → single block, object → 3-part).
- `progress`: use `record.progress` else undefined (UI shows no chip).

---

## Phase 1 — SKILL.md multi-turn rewrite

**File:** `skill/SKILL.md` (bump to 3.0.0). Sync copies handled in Phase 5.

**Flow to encode (verified against the real Adevinta email session):**
- **Step 0 — Mode:** detect `--dry-run` (extract + show, write nothing).
- **Step 1 — New vs existing project:** offer `save_record.py --list-projects` output; builder picks existing or "new".
- **Step 2 — Read everything:** whole conversation + artifacts the session created/read (files, commands+output, links, images). If existing project, also read its project.json + sections + recent tasks (inherit style/sequence/context). New project → propose sector / one_liner / role / name (logo: ask or initial badge).
- **Step 3 — Section select/create:** existing project → list its sections, ask "which stage or new?"; new → create first section. Sections come from the lifecycle set (Think→…→Reflect), custom allowed.
- **Step 4 — GATE 1 (candidate list only, no save):** table of candidates — section | task | sub_purpose | highlight? | evidence count. Builder does keep/drop/add/merge/split, and sets progress per task (default done). 
- **Step 5 — GATE 2 (per-card body, evidence ask):** for confirmed cards only, draft hybrid body (fixed fields + markdown). Auto-fill evidence found in chat; for missing/uncertain evidence, ASK the builder (accept/provide/decline) — never fabricate. Confirm each card.
- **Step 6 — Save:** confirmed cards only, via save_record.py. Report section rollup.

**Rules to keep:** judgment/highlight is hunted first (differentiator) but optional; never save without confirmation; traces only, never fabricate; one task per intent; not a PM tool (progress is builder-facing, not done/blocked status theater).

**Verify:** re-read SKILL.md; dry-run the Adevinta email session mentally against it (the simulation in chat 2026-09-10 is the acceptance script). No code runs yet — this phase is prose.

---

## Phase 2 — save_record.py

**File:** `skill/scripts/save_record.py`

**Add:**
- `--section` (replaces the role of `--category`; keep `--category` accepted → maps to section for back-compat).
- `--sub-purpose`, `--tools` (comma list), `--mindset` (comma list), `--progress` (done|ongoing|dropped|undecided).
- `--body-file` now written to `body_md` (keep writing `body` too for one release so old web builds don't break).
- Rename `--judgment*` semantics to `highlight` in the JSON output key `highlight`, but KEEP writing `judgment` too (dual-write) so the currently-deployed web keeps working until Phase 3 ships.
- `--list-projects` subcommand: scan ROOT, print JSON `[{slug, name, sector, sections:[{stage,title}]}]` for Step 1.
- project.json gains `sector`, `one_liner`, `logo`, `role` (all optional, only written if flags passed: `--sector`, `--one-liner`, `--logo`, `--role`).
- section.json (goal.json): gain `stage`, `order` (keep `title`).

**Isolated tests (tmp root, like the v2.1 test):**
1. Full v3 flags → record.json has section/sub_purpose/tools/mindset/progress/highlight + body_md.
2. Legacy `--judgment` string → still produces `judgment` string (back-compat).
3. `--list-projects` on a tmp store with 2 projects → correct JSON.
4. Existing project/section reuse → no duplicate ids.

**Verify:** run all 4, print resulting JSON, confirm shapes.

---

## Phase 3 — Web types + scanner (backward-compat read)

**Files:** `web/src/lib/types.ts`, `web/src/lib/fileSystem.ts`, `web/src/lib/portfolio.ts`, `web/src/lib/mockData.ts`

- Types: add `section`, `sub_purpose`, `tools`, `mindset`, `progress`, `body_md`; rename `Judgment`→also used by `highlight`. Keep old fields optional.
- Scanner `parseRecord`: implement the backward-compat read rules above. **Critical fix:** parse legacy `body` by H2 → named narrative sections (kills PURPOSE=WORK dup + raw `##`).
- project.json parse: read sector/one_liner/logo/role.
- section (goal.json) parse: read stage/order.
- Decision note: keep on-disk filenames `goal.json` (least churn, scanner already reads it) but treat as section. Do NOT rename files on disk this phase.

**Verify:** `npx tsc --noEmit` clean. Node repro script (like Phase-2 debugging) on the 4 real Adevinta records: confirm each yields distinct narrative sections (no dup), a section value, and highlight object. `?demo=1` still renders.

---

## Phase 4 — Web view: 3-level

**Files:** `web/src/app/home-content.tsx`, `web/src/components/*`

- **Row 1 — Project cards:** sector · logo/initial · name · one_liner · role. Click selects a project.
- **Row 2 — Section boxes:** lifecycle order (Think→…→Reflect), each showing its task cards + a progress rollup chip. Only sections present in the project render.
- **Task card:** sub_purpose · date · tools · mindset · progress chip · highlight?/evidence? badges (keep existing badge style).
- **Right detail panel:** hybrid body (parsed narrative sections) + highlight contrast (existing AI/Builder/Why render) + evidence list. Reuse the working judgment renderer.
- **Cross-cut toggle:** view by Project ↔ by Section (all Research across projects) ↔ by Tool (all Hermes work). This is the silo-breaker.
- Keep: All-Projects default, focus rescan, onboarding/marker flow untouched.

**Verify:** `?demo=1` shows 3-level nav; real folder (manual, by user) shows Adevinta project → sections → 4 tasks; detail panel narrative no longer duplicated. Production `next build` passes.

---

## Phase 5 — Sync + single upload

- Sync SKILL.md + save_record.py → npm payload, `~/.claude/skills`, `~/.cursor/skills`.
- Rebuild Cowork zip (v3.0.0) on Desktop.
- Bump npm to 1.4.0 (do NOT reuse 1.2.0/1.3.0). User runs `npm publish`.
- **One** upload cycle at the end: user re-uploads zip to Cowork, runs the real Adevinta session end-to-end, verifies 3-level output. Avoid mid-build upload loops.

---

## Regression gate (every phase)
The 4 existing Adevinta records (legacy `body` + `judgment`) must render at all times. If a phase breaks them, stop and fix before continuing.

## Risks / open questions
- Filename `goal.json` vs `section.json`: plan keeps `goal.json` on disk to avoid a migration; revisit only if it causes confusion.
- Dual-write (`body`+`body_md`, `judgment`+`highlight`) is temporary — remove one release after Phase 3/4 ship together.
- Custom sections outside the lifecycle set: allowed, but cross-cut aggregation groups them under "Other".
- The real portfolio's numeric-result culture: task cards should encourage a concrete Result line in `body_md`, but not force it (non-eng work may not have a metric).
