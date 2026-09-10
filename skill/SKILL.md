---
name: builders-diary
version: 3.6.0
description: Run an interactive, multi-turn Builder's Diary workflow at the end of a work session. Curate candidates, assign each task to a lifecycle section, review third-party-readable portfolio cards, and approve evidence before saving locally. For any builder (research, design, sales, engineering), not just coders.
triggers:
  - "builders-diary"
  - "record this work session"
  - "save this work"
  - "create a portfolio record"
  - "dry-run my work record"
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

## Interaction contract

- Use the client's structured question tool for every choice gate when it exists:
  - **Antigravity:** `ask_question` with `questions`, `options`, and `is_multi_select`.
  - **Claude Code:** `AskUserQuestion`; each question has `header`, `question`, 2–4
    `{label, description}` options, and `multiSelect`.
  Do not print numbered options as a sentence and ask the builder to type a number.
- On clients without a structured question tool, use a clean Markdown list as the fallback.
- Candidate curation must offer an explicit **Keep all candidates** option. A native `User Skipped`
  result is not approval to keep, drop, or modify anything: re-ask with explicit choices or stop.
- Keep all option labels and public portfolio fields in English: `title`, `section`, `purpose`,
  `tools`, `mindset`, public highlight summaries, evidence labels, and `body_md`. Conversational
  explanations may match the builder's language; private verbatim quotes may retain their source language.
- Ask one decision at a time. Wait for the answer before advancing to the next gate.

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
- **`--dry-run` present** → run **Steps 1–5 in full**, including project choice, candidate-list
  curation, per-task section choice, evidence visibility choice, and one-card-at-a-time review.
  All choices are provisional. At Step 6, show the final preview and STOP: write no
  project/section/task files, copy no evidence, and do not collapse the flow into a one-shot extraction.
- **no flag** → run all steps through saving (but never save before the builder confirms — Steps 4 & 5).

---

## Step 1 — Detect the current project, then match saved projects

Before asking anything, identify the project this conversation is actually about from **session-local
signals**:

1. Current workspace/root and recent command working directories.
2. The workspace folder name.
3. The first H1 in the workspace README and project metadata such as `package.json`.
4. Project names repeatedly mentioned in the conversation.

Use these signals only to make a recommendation; never silently choose for the builder. Then list
saved Builder's Diary projects. Resolve `scripts/save_record.py` **relative to the SKILL.md file that
was activated**. Do not search another AI client's skill directory first.

The installer injects the active client's exact helper path into the token below:

```bash
python3 "{{BUILDERS_DIARY_SCRIPT}}" --list-projects
```

Match the detected project against saved project names/slugs case-insensitively:

- Exact saved match → recommend attaching to that existing project.
- No saved match → recommend creating the detected project as a provisional new project.
- Always keep the other saved projects available as alternatives.

Use the client-specific structured question tool. For a workspace whose README says `JobSpy` while the saved list
contains only Adevinta, the single-select options should be:

```text
Question: Which portfolio project is this session for?
Options:
- Create “JobSpy” — detected from the current workspace (Recommended)
- Adevinta AI House EiR — existing · 3 sections · 4 tasks
- Choose another project
```

Do not output all options in one paragraph. Wait for the choice.

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
  In dry-run mode, label it **provisional** and do not create its folder or `project.json`.
- **Existing project** → also read its `project.json`, its sections, and recent tasks, so you
  inherit its style, sequence numbers, and context. Skip project creation.

---

## Step 3 — Generate candidate tasks (no session-wide section gate)

Sections are builder-lifecycle stages: **Think → Plan → Build → Review → Test → Ship → Reflect**
(custom allowed). They belong to **tasks**, not to a whole session. A single session can produce a
Review task and a Build task; do not ask the builder to classify the entire session before they can
see its candidate tasks.

From the traces, infer a `likely_section` for each candidate. It is a draft recommendation only;
the builder confirms the actual section for each retained task in Step 5.

---

## Step 4 — GATE 1: candidate list curation (no save, no body yet)

**A session usually contains more than one task.** Split by *intent* — different problem,
different aim, or work that stands on its own. Same file edited five times for one purpose = one task.

Present candidates as a compact Markdown table — draft section, title, and one-line purpose only;
no full bodies yet:

```text
[builders-diary] N candidate tasks found

#  Draft section  Task                                      Highlight  Evidence
1  Think          Reframe email: tool-intro → running proof  ✓          chat, proposal.md
2  Think          Catch the stale-source claim, re-research   ✓          research.md
3  Plan           Reject 4-day market test → internal setup   ✓          chat
```

First use the client's structured question tool in single-select mode:

```text
Question: How should these N candidate tasks be curated?
Options:
- Keep all N candidates (Recommended)
- Choose individual candidates
- Modify the list
- Stop this dry run
```

Then follow the answer exactly:
- **Keep all** → retain every candidate and continue to Step 5.
- **Choose individual candidates** → ask a follow-up multi-select question with one concise option
  per candidate plus `I want to modify the list`. Retain only selected candidates.
- **Modify the list** → ask for merge/split/add/drop edits, then show the revised list and repeat
  this gate.
- **Stop this dry run** → report that no candidates were confirmed and stop.
- **User Skipped** → do not infer a choice. Re-ask this curation question or stop.

Suggest progress per task, but never finalize `done` without confirmation.

**STOP and wait.** This gate is what prevents dumping a pile of half-relevant cards.
The builder curates the LIST before any body is written.

---

## Step 5 — GATE 2: per-task section + card + evidence, one at a time

For each confirmed task, run the following sequence before advancing to the next task.

### A. Confirm this task's section

Use the client's structured question tool in single-select mode. Ask which lifecycle stage best
represents this task, with the inferred `likely_section` first and marked Recommended. Include other
plausible stages and `Choose another section`. Do not inherit a section from a session-wide choice.
In dry-run mode, label a new section **provisional** and do not create its folder or `goal.json`.

### B. Draft a complete, third-party-readable card

**Fixed fields** — section, purpose, tools, mindset, progress.

**Highlight** (if present) — the three-part contrast, near-verbatim from the chat.

**body_md is required.** Write it for a third party who did not see this chat, does not know the
project, and does not know the builder. It must explain the starting context, the concrete problem or
decision, what the builder decided and why, what work occurred, and what evidence supports the result.
Do not write `in this conversation`, `as discussed`, or unexplained internal file paths as if the
reader already has context.

Choose H2 sections that fit the work type. Examples:
- product/architecture work → `## Context` / `## Decision` / `## Work` / `## Verified result`
- research → `## Question` / `## What I dug into` / `## Finding`
- marketing → `## Goal` / `## Outreach approach` / `## Outcome`
- design → `## Problem` / `## Design decisions` / `## Result`
Keep a concrete Result line when one exists (a number, a shipped artifact) — don't force a metric
onto work that has none. State only outcomes the evidence proves. If a user-visible effect has not
been measured, describe the implementation or expected effect instead of claiming it happened.

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
- For generated files, use the client's structured question tool in multi-select mode and ask which artifacts to
  include in the public evidence bundle. Show safe labels and filenames, not full absolute paths.
  Selected files become approved copies in `record/evidence/`; unselected files remain private traces.
- In dry-run mode, run the same public-evidence selection gate and label selected artifacts
  **provisionally approved**. Do not copy files or write evidence JSON yet.
- **If you can't find it or you're unsure, ASK** — do not fabricate and do not silently skip:
  > "This task would be stronger with the result screenshot / the link to X. Do you have one?
  >  Paste it and I'll attach it, or say skip."
  Builder-approved evidence only. This ask is a feature, not a nuisance — it's what makes the
  card trustworthy.

After the section and public-evidence choices, show one complete card, including `body_md`, then use
the client's structured question tool in single-select mode with exactly these actions:
`Approve this card`, `Edit this card`, `Drop this card`. Wait for the answer before moving to the
next card. If editing, collect the requested changes and show the revised card again.

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

## Step 6 — Save each confirmed task (or finish the dry-run preview)

**Dry-run path:** after every confirmed card has been reviewed, report the exact project/section/task
structure and provisional public-evidence choices that would be created, then STOP. Do **not** call
`save_record.py`, write temp body/evidence files, create folders, or copy approved artifacts. Say
`No files were saved.` The builder can then start a normal run when ready to save.

**Normal path:** for each confirmed task:

1. Write `body_md` to a temp markdown file (so special characters survive).
2. Write the evidence list to a temp JSON file.
3. Call the script:

```bash
python3 "{{BUILDERS_DIARY_SCRIPT}}" \
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

For a normal run, report each saved task's script output (record_id, section, progress, highlight
captured?, evidence count, path) and the section rollup:

```
Saved 3 tasks.
  Think: 2 done  ·  Plan: 1 ongoing
View your portfolio: http://localhost:3111
```

For a dry run, report the provisional project, per-task sections, task count, and approved evidence
count, then use the exact words:

```
Dry run complete. No files were saved and no evidence was copied.
Start a normal Builder's Diary run when you are ready to save these approved cards.
```

---

## Rules

- **Two gates, always.** Curate candidates first (Step 4), then confirm every retained task's
  section, evidence visibility, and complete card (Step 5). Never dump finished cards in one shot.
- **Keep all is explicit.** Never treat `User Skipped` as candidate approval; the builder must choose
  Keep all, choose individually, modify, or stop.
- **Sections belong to tasks.** Infer a draft section in the candidate table, then ask the builder to
  confirm the section for every retained task.
- **Write for an outside reader.** Every public card must stand alone for a third party unfamiliar
  with the chat, project, or internal filenames. Public portfolio text is English; private source
  quotes may remain verbatim.
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
