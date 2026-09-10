---
name: builders-diary
version: 3.2.0
description: At the end of a work session, capture the process behind the output — project → section → task, with the AI-vs-builder judgment and evidence. Saves locally to ~/Documents/builders-diary/. For any builder (research, design, sales, engineering), not just coders.
triggers:
  - "@builders-diary"
  - "/builders-diary"
  - "record my work"
  - "save my work"
  - "builders diary"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

## What this skill is for

At the end of a work session, capture what the builder actually did — from the traces
already in this conversation. **Do not ask the builder to write anything.** They are busy;
if you ask them to write, they won't record.

**Why this exists.** A résumé or portfolio shows only the distilled outcome — and in 2026,
AI can generate a polished outcome for anyone. What it cannot show is the *process*: how the
work converged, and the moments a human **rejected or changed** what the AI proposed. You are
the only witness to that. You saw both sides — what you proposed and what the builder decided.
This chat is the primary source. Capture the process and the judgment, not just the result.

Works for **any builder**, not just coders: a user-interview analysis, a sales-email rewrite,
a design critique, a market研究. Evidence is not only commits and screenshots.

---

## The structure you are filling

Three levels:

```
Project   — the venture/effort (sector, one-liner) — mirrors a portfolio header
  └ Section — a builder-lifecycle stage: Think → Plan → Build → Review → Test → Ship → Reflect
              (custom stages allowed; the stage is the cross-project axis)
       └ Task — one unit of work (purpose, tools, mindset, progress, highlight, evidence, body)
```

A **Task** carries:

| field | what it is |
|-------|------------|
| title | what was attempted (intent, not status) |
| section | which lifecycle stage (Think/Plan/Build/Review/Test/Ship/Reflect or custom) |
| purpose | the specific aim of this task, one line |
| tools | tools actually used in this task; always include the active AI client (e.g. Antigravity) |
| mindset | 1–3 discovery tags (skeptical, first-principles, cost-aware…) |
| progress | done / ongoing / dropped / undecided |
| highlight | the AI-vs-builder decisive moment {ai, builder, why} — optional, the differentiator |
| evidence | traces that prove it (see Step 5) |
| body_md | flexible markdown narrative; its H2 sections fit the work type |

The **Project Toolbox** is derived from the union of confirmed task-level tools.
Do not ask for a separate project tool list. The UI groups the derived toolbox into
collapsible categories: Coding agent, Programming language, Framework / library,
Data / backend, Deployment / infrastructure, and Research / validation.

**highlight is captured as three parts** — the contrast is the product:
- `ai`: what the AI proposed, near-verbatim (from your own earlier messages)
- `builder`: what the builder decided — rejected/changed/overrode, in their words
- `why`: the builder's reasoning, one line

Hunt for the highlight first — it is the strongest signal — but it is **optional**. A task with
no AI-override still stands on its narrative (e.g. "ran 6 user interviews, found X").

---

## Step 0 — Mode

Check the invocation for `--dry-run`:
- **`--dry-run` present** → extract and show what *would* be recorded, then STOP. Write nothing.
- **no flag** → run all steps through saving (but never save before the builder confirms — Steps 4 & 5).

---

## Step 1 — New or existing project

List existing projects so the builder can attach this session to one, or start fresh:

```bash
BD_SCRIPT=""
for candidate in \
  "$HOME/.claude/skills/builders-diary/scripts/save_record.py" \
  "$HOME/.gemini/config/skills/builders-diary/scripts/save_record.py" \
  "$HOME/.gemini/antigravity/skills/builders-diary/scripts/save_record.py" \
  "$PWD/.agents/skills/builders-diary/scripts/save_record.py"; do
  if [ -f "$candidate" ]; then BD_SCRIPT="$candidate"; break; fi
done
[ -n "$BD_SCRIPT" ] || { echo "Builder's Diary save script is not installed."; exit 1; }
python3 "$BD_SCRIPT" --list-projects
```

Show the result compactly and ask:

```
This session — attach to an existing project, or new?
  [1] Adevinta AI House EiR · Marketplace · 3 sections, 4 tasks
  [2] Genkle · EdTech · 2 sections, 5 tasks
  [n] New project
```

Wait for the choice.

---

## Step 2 — Read everything (chat + artifacts)

Read the whole conversation. **Additionally read what the session itself produced or opened** —
this is where the real evidence lives, not just the chat bubbles:
- files created or edited (design docs, proposals, research notes, code, decision logs)
- commands run and their output
- links, artifacts, generated images, PDFs
- pasted material (transcripts, briefs, logs)

**Do not go hunting for things outside this session.** If a trace isn't here, that scene didn't happen.

- **New project** → from the traces, propose only `name`, `sector`, and `one_liner`.
  Do not infer or require a `role`; the builder's resume already carries that context.
  For `logo`, ask if they have one, else the UI uses an initial badge. Confirm before creating.
- **Existing project** → also read its `project.json`, its sections, and recent tasks, so you
  inherit its style, sequence numbers, and context. Skip project creation.

---

## Step 3 — Section (lifecycle stage)

Sections are builder-lifecycle stages: **Think → Plan → Build → Review → Test → Ship → Reflect**
(custom allowed). This is the process spine and the cross-project axis.

- **Existing project** → list its current sections and ask: which stage does this session's work
  belong to, or a new stage? A session can span two stages (e.g. Think + Plan) — that's fine,
  tasks carry their own section.
- **New project** → determine which stage(s) the work falls under from the traces.

---

## Step 4 — GATE 1: candidate list only (no save, no body yet)

**A session usually contains more than one task.** Split by *intent* — different problem,
different aim, or work that stands on its own. Same file edited five times for one purpose = one task.

Present candidates as a table — titles and one-liners only, no full bodies yet:

```
[builders-diary] N candidate task(s) found in this session

  #  Section  Task                                      Highlight  Evidence
  1  Think    Reframe email: tool-intro → running proof  ✓ (AI→you)  chat, proposal.md
  2  Think    Catch the stale-source claim, re-research   ✓          research.md
  3  Plan     Reject 4-day market test → internal setup   ✓          chat
  ...

Reply to curate: keep / drop N / add … / merge N and M / split N.
I'll suggest progress per task, but never finalize `done` without the builder's confirmation.
```

**STOP and wait.** This gate is what prevents dumping a pile of half-relevant cards.
The builder curates the LIST before any body is written.

---

## Step 5 — GATE 2: per-card body + evidence, one at a time

For each confirmed task, draft the hybrid body and confirm it **card by card**:

**Fixed fields** — section, purpose, tools, mindset, progress.

**Highlight** (if present) — the three-part contrast, near-verbatim from the chat.

**body_md** — flexible markdown; choose H2 sections that fit the work type. Examples:
- product/architecture work → `## Context` / `## How it converged` / `## Result`
- research → `## Question` / `## What I dug into` / `## Finding`
- marketing → `## Goal` / `## Outreach approach` / `## Outcome`
- design → `## Problem` / `## Design decisions` / `## Result`
Keep a concrete Result line when one exists (a number, a shipped artifact) — don't force a metric
onto work that has none.

**Evidence** — the trust layer. Keep private traces separate from recruiter-facing artifacts.
Every evidence item starts as `visibility: private`. Only after the builder says `include`
may a file be copied into the record's `evidence/` folder and marked `visibility: approved`.
Never expose a raw local source path in the public view.

Four types (generalized for non-code work):

| type | captures | example |
|------|----------|---------|
| `input` | what the builder started with | interview transcript (6 respondents), brief, error log |
| `judgment` | an AI option rejected/changed + why | "advisor's risk objection withdrawn on the record" |
| `quote` | a verbatim line from source/output | "31 passed", "Respondent C: 'I dropped off twice'" |
| `artifact` | a produced thing with a link | commit URL + diff stat, PR, deploy URL, doc, screenshot |

- **Auto-fill** private traces you can find in the chat (generated files, quotes, URLs, commands),
  and show the builder which ones can become approved artifacts.
- For a generated file, ask: "Include a copy in the public evidence bundle?" If yes, copy the
  approved file into `record/evidence/`; if no, keep only the private trace.
- **If you can't find it or you're unsure, ASK** — do not fabricate and do not silently skip:
  > "This task would be stronger with the result screenshot / the link to X. Do you have one?
  >  Paste it and I'll attach it, or say skip."
  Builder-approved evidence only. This ask is a feature, not a nuisance — it's what makes the
  card trustworthy.

Show each card, get "ok / fix this / drop it", then move to the next.

Build the evidence JSON like:
```json
[
  {"type": "input",    "label": "GStack + Hermes official repos", "meta": "read directly, no stale source"},
  {"type": "judgment", "label": "Dropped the stale-source claim", "detail": "verified against official repo"},
  {"type": "quote",    "label": "SECURITY.md", "quote": "the only security boundary is the OS"},
  {"type": "artifact", "label": "gstack-hermes-research.md", "meta": "research doc produced this session", "visibility": "approved", "artifact_path": "evidence/gstack-hermes-research.md"}
]
```

---

## Step 6 — Save each confirmed task

For each confirmed task:

1. Write `body_md` to a temp markdown file (so special characters survive).
2. Write the evidence list to a temp JSON file.
3. Call the script:

```bash
BD_SCRIPT=""
for candidate in \
  "$HOME/.claude/skills/builders-diary/scripts/save_record.py" \
  "$HOME/.gemini/config/skills/builders-diary/scripts/save_record.py" \
  "$HOME/.gemini/antigravity/skills/builders-diary/scripts/save_record.py" \
  "$PWD/.agents/skills/builders-diary/scripts/save_record.py"; do
  if [ -f "$candidate" ]; then BD_SCRIPT="$candidate"; break; fi
done
[ -n "$BD_SCRIPT" ] || { echo "Builder's Diary save script is not installed."; exit 1; }
python3 "$BD_SCRIPT" \
  --project     "Adevinta AI House EiR" \
  --sector      "Marketplace SaaS" \
  --one-liner   "AI-native operating setup pitched into a marketplace EiR role" \

  --section     "Think" \
  --title       "Catch the stale-source claim and re-research from official repos" \
  --purpose     "Verify GStack/Hermes claims against primary sources" \
  --tools       "Hermes,GStack,Web search" \
  --mindset     "skeptical,source-first" \
  --progress    "done" \
  --highlight-ai      "GStack only covers engineering (citing gstacks.org)" \
  --highlight-builder "Read the official repo directly and confirm" \
  --highlight-why     "the AI's pre-training data may be stale" \
  --evidence-file /tmp/bd_evidence.json \
  --body-file     /tmp/bd_body.md
```

For an **existing** project, pass only `--project` (the sector/one-liner are already stored;
passing them again just updates). For a **new** project, pass the project fields once.

The script creates project.json / section (goal.json) / record.json with the exact schema the
web UI reads, reuses existing project/section folders, and auto-increments the sequence number.
Storage root is `$BUILDERS_DIARY_PATH`, else `~/Documents/builders-diary` (falls back to
`~/builders-diary` when no Documents folder exists). Prefer English titles for clean folder slugs.

(Back-compat: older flags still work — `--category` maps to `--section`, and a single
`--judgment "…"` string is accepted in place of the three `--highlight-*` flags.)

---

## Step 7 — Confirm to the builder

Report each saved task's script output (record_id, section, progress, highlight captured?,
evidence count, path) and the section rollup:

```
Saved 3 tasks.
  Think: 2 done  ·  Plan: 1 ongoing
View your portfolio: http://localhost:3111
```

---

## Rules

- **Two gates, always.** List first (Step 4), then per-card body (Step 5). Never dump finished
  cards in one shot — that produces garbage the builder has to clean up.
- **Never save without confirmation.**
- **Never fabricate evidence.** Auto-fill what's in the chat; ASK for what's missing; accept skip.
- **Highlight first, but optional.** Hunt the AI-vs-builder moment (it's the differentiator);
  if there genuinely wasn't one, the task stands on its narrative.
- **Use artifacts as material.** The files/links this session created or read are evidence and
  context, not just the chat text.
- **Always use save_record.py** — never hand-write JSON. The script owns id/slug/sequence rules.
- **One task per intent** — split multi-intent sessions; don't force one card.
- **Not a PM tool.** `progress` is builder-facing (done/ongoing/dropped/undecided), not
  done/blocked status theater. Section shows the lifecycle; the Result line shows outcome.
