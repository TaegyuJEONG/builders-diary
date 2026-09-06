---
name: builders-diary
version: 2.1.0
description: Record what you actually judged in a work session — not just what got built. Saves locally to ~/Documents/builders-diary/. Works for any builder (research, design, sales, engineering), not just coders.
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
if you ask, they won't record.

**The single most valuable thing to capture is judgment**, not output. In 2026, AI-generated
output is cheap and proves little. What a recruiter can't get anywhere else — and what an AI
can't fake — is the moment a human **rejected or changed** what the AI proposed, and why.

**You are the only witness.** You (the agent in this chat) saw both sides: what you proposed
and what the builder did with it. A résumé or blog is the builder's own claim, written after
the fact. This chat is the primary source. That is exactly why judgment must be captured as
**both sides, verbatim** — what the AI put on the table, and what the builder decided.
A session where the AI suggested five options and the builder killed two and picked one is
worth more than a session that just shipped code. Hunt for that moment first.

This works for **any builder**, not just coders: a user-interview analysis, a sales-email
rewrite, a design critique, a research synthesis. Evidence is not just commits and screenshots.

---

## Step 0 — Mode

Check the invocation for `--dry-run`:
- **`--dry-run` present** → dry-run mode: extract and show what *would* be recorded, then STOP.
  Write nothing.
- **no flag** → normal mode: run all steps through saving.

---

## Step 1 — Extract the distinct work items from this session

Read the whole conversation. Additionally open only what the conversation itself references:
files touched, commands run and their output, commit messages, pasted material (transcripts,
briefs, logs), issue/PR links. **Do not go hunting for things not in the session.** If a trace
isn't here, that scene didn't happen.

**A session can contain more than one work item.** People don't always keep one project per
window. Split into separate items when the *intent* differs — different problem, different
project, or work that stands on its own. Same file edited five times for one purpose = one item.

For each work item, determine:

| Field | What it is |
|-------|------------|
| **title** | What was attempted (the intent, not a status) |
| **project** | Which project it belongs to |
| **goal** | Which goal under that project |
| **category** | One of: `Planning` `Design` `Engineering` `Research` `Growth` |
| **judgment** | Both sides of the decisive moment (see below). Empty only if there truly was none. |
| **evidence** | Traces that prove it happened (see Step 2) |

**Judgment is captured as three parts** — the contrast is the product:

- `ai`: what the AI actually proposed, close to verbatim (e.g. "Recommended adversarial
  reading B/C; ranked 'add tutorial' as #1 fix")
- `builder`: what the builder decided — rejected / changed / overrode, in their words when
  possible (e.g. "Rejected both rounds; fixed the model so the advisor withdrew the risk")
- `why`: the builder's reasoning, one line (e.g. "the #1 ranking rested on a single respondent")

Pull `ai` from your own earlier messages in this chat; pull `builder` and `why` from the
builder's replies. Quote or closely paraphrase — do not smooth into generic summary language.

Then map each item to the existing store (Step 3 checks folders). If a project/goal already
exists, reuse it; if not, propose a new one.

---

## Step 2 — Gather evidence (from traces only)

Evidence is any trace in the session that proves the work. **Four types**, generalized so
non-code work counts too. Collect only what's actually present — never fabricate, never ask.

| type | what it captures | dev example | non-dev example |
|------|------------------|-------------|-----------------|
| `input` | what the builder started with | error log, failing issue | interview transcript (6 respondents, 12k words) |
| `judgment` | an AI option rejected/changed + why | "rejected the suggested refactor — out of scope" | "AI ranked 'add tutorial' #1; rejected — one respondent only" |
| `quote` | a verbatim line from source or output | "31 passed", "Ready in 1846ms" | "Respondent C: 'I dropped off twice in onboarding'" |
| `artifact` | a produced thing with a link | commit URL + diff stat, PR, deploy URL, screenshot | decision doc, revised roadmap, published spec |

Build a JSON list like this (only include what you found):

```json
[
  {"type": "input",    "label": "User interview transcripts", "meta": "6 respondents, 12k words"},
  {"type": "judgment", "label": "Rejected AI's #1 ranking",    "detail": "based on a single respondent"},
  {"type": "quote",    "label": "Respondent C",               "quote": "I dropped off twice in onboarding"},
  {"type": "artifact", "label": "commit a1b2c3",               "url": "https://github.com/…/commit/a1b2c3", "meta": "+412 −80, 7 files"}
]
```

If the host tool can capture a screenshot of a running localhost/deploy URL, add one artifact
with a local image path. If it can't, skip silently.

---

## Step 3 — Dry-run output (only when `--dry-run`)

Print this and STOP. Write nothing.

```
[builders-diary dry-run] N work item(s) found in this session

[1] Title:    <title>
    Category: <category>
    Project:  <project> → Goal: <goal>   (existing | NEW)
    AI proposed:    <one line, or "— none">
    Builder's call: <one line>
    Why:            <one line>
    Evidence: input ✓ | judgment ✓ | quote ✓ | artifact ✓   (only the ones found)

[2] …

Run without --dry-run to record. Reply to drop or merge any item.
```

---

## Step 4 — Confirm (normal mode)

Show the same list as Step 3 and wait for the builder's reply.
- "save" / "yes" → save all
- "drop 2", "merge 1 and 3", corrections → adjust, then save
- If any item has **no judgment**, that's allowed — but if the session clearly had a
  rejection/decision you missed, add it before saving.

**Stop and wait for the reply.** Never save before confirmation.

---

## Step 5 — Save each item

For each confirmed item:

1. Write the body to a temp markdown file (so special characters survive). Body structure:

```markdown
## What was the problem
[1-2 sentences — why this work was needed]

## What was done
[2-5 sentences — specific actions]

## The judgment call
[What the AI proposed, what you rejected/changed, and why. The heart of the record.]

## Result
[Concrete outcome]
```

2. Write the evidence list to a temp JSON file.

3. Call the script:

```bash
python3 ~/.claude/skills/builders-diary/scripts/save_record.py \
  --project  "Project Title" \
  --goal     "Goal Title" \
  --title    "Concise title — what was attempted" \
  --category "Research" \
  --tags     "tag1,tag2" \
  --judgment-ai      "what the AI proposed (near-verbatim)" \
  --judgment-builder "what the builder decided" \
  --judgment-why     "the builder's reasoning, one line" \
  --evidence-file /tmp/bd_evidence.json \
  --body-file     /tmp/bd_body.md
```

(Older hosts may only support a single `--judgment "…"` string — the script accepts both;
prefer the three-part form.)

The script creates project.json / goal.json / record.json with the exact schema the web UI
reads, reuses existing project/goal folders, and auto-increments the sequence number.
Storage root is `$BUILDERS_DIARY_PATH`, else `~/Documents/builders-diary` (falls back to
`~/builders-diary` when no Documents folder exists). Prefer English titles for clean
folder slugs.

---

## Step 6 — Confirm to the builder

Report each saved item's script output: record_id, category, whether judgment was captured,
evidence count, and path. Then:

```
View your portfolio: http://localhost:3111
```

---

## Rules

- **Judgment first.** The rejection/decision moment is the most valuable thing here. Look for
  it before anything else. If it exists, it goes in.
- **Never save without confirmation** (Step 4).
- **Never fabricate evidence, never ask the builder for it.** Traces only.
- **Always use save_record.py** — never hand-write JSON. The script owns id generation,
  slug rules, and sequence counting.
- **One record per intent** — split multi-intent sessions; don't force one card.
- **This is not a project-management tool.** No status like done/blocked. Category shows range;
  the Result section shows outcome.
