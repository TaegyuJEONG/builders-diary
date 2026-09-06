# Card & Detail Redesign — Browsing-first cards, comprehension-first detail

**Goal:** Restructure the record schema, skill output, and web UI around the corrected
product thesis: **cards are for browsing** (recruiter scanning + builder navigation),
**detail pages are for third-party comprehension** (recruiter judging depth; builder
recalling context months later). Fix the six issues the user identified on 2026-09-06.

**Source of truth for the thesis (user's words, paraphrased):**
- Recruiters arrive from a resume, already interested; they open the diary to judge
  *depth* — thinking process, tool fluency, proof. Fixed portfolios go stale because
  building tempo outpaces them; the diary is the living replacement.
- Builders juggle too many projects to retain deep memory. Records written in
  project-internal shorthand become unreadable to their own author months later.
- Therefore: cards optimize for scanning (keywords: tools, mindset, domain — not
  prose like "What was the problem"); detail pages must be written so a third party
  understands what was done and how, and leaves with insight.

---

## The six issues → what each becomes

### 1. Judgment highlight carries no meaning
Card shows a `◆ judgment` chip — label without content. A recruiter learns nothing.
**Fix:** drop the chip from the card. On the card, judgment's job is done by keywords
(see #5). In the DETAIL page, judgment stays as the lead section but gets a
structure that explains itself: what the AI/default path proposed → what the builder
did instead → why. Rendered as "Proposed → Overruled → Because" rows, not one blob.

### 2. Evidence is title-only — nothing to open
Evidence items today: `{type, label, meta}` — dead text. The skill session CAN read
actual logs/links/files at save time.
**Fix (chosen: files-on-disk, the local-first way):**
- `save_record.py` gains `--evidence-file` payloads: each evidence item may carry
  `content` (verbatim text: log excerpt, quote, diff) and/or `url`.
- Script writes each content-bearing item to `evidence/NN-slug.md` (or .txt/.log)
  inside the record folder; record.json evidence[] gains `{file, url?}` refs.
- Web detail page: evidence items expand inline (accordion) showing the file text;
  links open in new tab. File stays owned by the user, greppable, portable.
- SKILL.md instructs the AI to attach the actual artifact text it already read
  (log lines, quote passages, commit summaries), not just a label.
Benchmark note: this mirrors how legal exhibits and lab notebooks work — claims
up front, numbered exhibits attached. Better fit for "audit trail" positioning than
external links (which rot) or screenshots (which don't grep).

### 3. Edit form is Purpose/Work/Result but records are body-markdown
DetailPanel edit mode edits `summary/content/result` fields that the skill never
writes (it writes `body` markdown). Editing a real record shows empty boxes.
**Fix:** make the edit form match the real schema: Title, Category, Tags,
Judgment, Body (one markdown textarea). Purpose/Work/Result dies as a form; the
body template (`## What was the problem` etc.) remains a *writing convention* the
skill follows, not a storage structure. saveRecordToFile updates accordingly.

### 4. Categories are a fixed enum — users need their own
**Fix:** categories become data, not code.
- New top-level file in the store: `.builders-diary/config.json` (written by
  installer/skill/web; dotfolder so scanner ignores it) with
  `{categories: [{name, color}]}` seeded from the current five.
- Web: settings popover (gear next to tools icon) — add / rename / delete /
  recolor. Renaming rewrites nothing on disk: records keep their string; unknown
  categories render with a neutral color and appear in the manager for adoption.
- `save_record.py`: drop the hard `choices=` constraint; accept any non-empty
  string, warn-not-fail on unknown (AI may invent; user can rename later).
- SKILL.md: read config.json categories at save time when present.

### 5. Card highlight = keywords (mindset + tools + domain)
The card's scannable payload becomes structured keywords, not judgment/evidence chips.
- Schema: record.json gains `keywords: {mindset: [], tools: []}` alongside
  legacy `tags` (kept for back-compat; scanner merges).
- SKILL.md: at save time the AI classifies — mindset (entrepreneurial,
  systematic-debugging, user-empathy, speed-over-polish…), tools (hermes-agent,
  claude-code, supabase, figma…). Free vocabulary, lowercase-hyphenated.
- Card render: category dot + title + result line + up to 4 keyword chips
  (tools first, then mindset), overflow "+N".
- Domain (분야) lives on the PROJECT, not the record: project.json gains
  `domain?: string` ("marketplace", "AI tooling"…); shown next to project name
  in header/filters. Skill asks/infers once per project.
- Filters panel: Mindset and Tools sections now populate from keywords;
  keyword search box searches both + related-term suggestions = other keywords
  co-occurring with the typed term on the same records (cheap association, no LLM).
This is what the resume/recruiter pitch needs: "show me every card where
'hermes-agent' or 'entrepreneurial' shows up" is one chip click.

### 6. Detail page = third-party comprehension
Restructure the SKILL.md body template so records read like a case study to an
outsider, banning project-internal shorthand:
```
## Context            (2-3 sentences a stranger can follow: what project, what
                       stage, why this mattered — no internal jargon unexplained)
## The judgment call  (Proposed → Overruled → Because, from #1)
## What was done      (steps, tools by name, dead ends kept)
## Proof              (numbers + pointers to evidence exhibits from #2)
## What this shows    (1-2 sentences: the transferable capability — the insight
                       a recruiter takes away; doubles as the builder's recall hook)
```
Detail panel renders these sections with visual hierarchy (Context and What this
shows emphasized for recruiters; Proof wired to evidence accordion).
SKILL.md gains an explicit rule: "Write for a reader who has never seen this
project. Expand every internal codename on first use."

---

## Also in scope (user asked directly)

### 7. Onboarding: Claude ecosystem split (chat / cowork / code)
Tool list becomes Claude-ecosystem-aware with per-surface guides, multi-select
shows ALL relevant guides stacked:
- **Claude Code (terminal)** → npx command (current flow)
- **Claude Desktop — Cowork & Chat** → download skill zip button
  (web serves `/builders-diary-skill.zip` from `public/`, built from the same
  skill source) + steps: Customize → Skills → Upload → toggle on
- **Cursor / Windsurf / Cline** → npx command (current flow)
- **ChatGPT / Codex** → Upcoming (greyed, per user decision)
Header tools popover mirrors the same split: Claude-ecosystem entries
addable/removable (remove = uninstall instructions), others Upcoming.

### 8. Filters: search + related terms (folded into #5's filter work)

---

## Execution order (dependencies)

Phase A — schema + skill (foundation)
1. `save_record.py`: keywords{mindset,tools}, evidence content→files, category
   free-string, config.json read. Bump skill to 2.1.0.
2. SKILL.md v2.1: new body template (#6), keyword classification (#5),
   evidence-content capture (#2), category config awareness (#4).
3. Migration helper `scripts/migrate_records.py`: walk existing store,
   map legacy tags→keywords.tools (best-effort), leave body untouched.
   (6 real records exist; run once, verify by hand.)

Phase B — web read path
4. types.ts + fileSystem.ts: parse keywords, evidence file refs, config.json;
   merge legacy tags.
5. Card redesign (#1, #5): keyword chips, no judgment/evidence chips.
6. Detail redesign (#6, #2): sectioned body render, judgment rows,
   evidence accordion reading evidence/ files via directory handle.
7. Filters (#5, #8): mindset/tools from keywords, search, related terms.

Phase C — web write path + management
8. Edit form rebuild (#3): Title/Category/Tags/Judgment/Body; saveRecordToFile
   rewrite to match real schema.
9. Category manager UI (#4): config.json CRUD popover.
10. Project domain: scanner + header display; skill asks once (#5-domain).

Phase D — onboarding + distribution (#7)
11. Build skill zip into web/public at build time (script), download button.
12. Onboarding per-surface guides, multi-select stacking.
13. Header tools popover: ecosystem split + remove instructions.

Phase E — ship
14. npm 1.3.0 (new save_record + SKILL), publish; web deploy (vercel --prod);
    re-run end-to-end with a fresh session on the real store.

## Verification
- Unit-ish: run save_record.py with keywords/evidence-content fixtures; assert
  files land in evidence/, record.json refs resolve.
- Migrate real store copy in /tmp first; diff record counts.
- Browser: all six issues re-tested against the live store (6 records, 2 projects).
- tsc + next build green before each commit; commits per phase.

## Risks / open questions
- Evidence files grow store size — cap per-item content at ~10KB in the script.
- Free-vocabulary keywords can fragment ("hermes" vs "hermes-agent") — related-terms
  UI mitigates; consider a normalize map in config.json later.
- Cowork zip is claude.ai-account-scoped; store writes from Cowork depend on that
  session's local access (worked in user's test, but keep the Downloads fallback
  instruction in SKILL.md).
- Old records keep old body structure; migration does NOT rewrite prose. Cards
  render fine (title/result/keywords); detail shows legacy sections as-is.
