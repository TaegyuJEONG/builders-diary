# Claude Bulk Portfolio Import Implementation Plan

> **For Hermes:** Implement this plan task-by-task only after the product decisions in “Decisions to confirm” are approved. Keep the existing daily Builder’s Diary skill working throughout.

**Goal:** Add a user-controlled bulk-import workflow that discovers retained Claude work, proposes portfolio projects and task cards in stages, and saves only confirmed material into the existing local Builder’s Diary portfolio.

**Architecture:** Build provider-specific, read-only source adapters behind a separate `builders-diary-import` skill. Discovery and filtering happen locally first; selected, minimized excerpts are summarized in bounded batches by a low-cost model; all intermediate state stays in a private resumable import workspace; confirmed projects and cards are projected into the existing `Project → Section → Task` schema and appear incrementally in the web app.

**First supported source:** Claude Code local sessions on macOS. Personal Claude Chat/Projects support follows only after validating a real user-downloaded Claude data export. Enterprise Compliance API support is a separate later connector.

---

## 1. Research conclusion

### 1.1 What the Codex onboarding screenshot actually imports

OpenAI describes this as importing from another **agent**, not importing a user’s complete cloud account. It imports supported local setup, existing project folders, and chats from the last 30 days. Codex CLI additionally caps discovery at 50 chats.[1] The public Codex implementation scans the external agent’s local `projects/*/*.jsonl` files.[8]

Therefore:

- The screenshot’s **Projects** are existing local project folders, not Claude.ai Projects.
- The screenshot’s **Chat sessions** are recent local Claude Code/Cowork/Cursor agent sessions, not all Claude.ai chat history.
- The observed `49` chat count is consistent with the documented recent-session importer; it is not evidence that Codex accessed the user’s entire Claude account.

### 1.2 Claude Code local history

Claude Code stores session transcripts under `~/.claude/projects/<project>/<session-id>.jsonl`. A transcript contains the conversation, tool calls, and tool results.[2][3] The JSONL format is explicitly internal and can change between Claude Code releases, so a Builder’s Diary parser must fail safely when the format drifts.[2]

The default local retention is 30 days unless `cleanupPeriodDays` is changed. Claude Desktop and Cowork-originated transcripts have a separate retention rule in current versions.[3][7]

A read-only metadata and schema probe on this Mac found:

- 13 top-level Claude project directories.
- 104 main session JSONL files, totaling 75,682,275 bytes.
- 56 subagent JSONL files.
- 2,574 user entries and 4,367 assistant entries.
- 2,266 tool-use markers and 2,266 tool-result markers.
- `cleanupPeriodDays` is unset, so the documented default applies.

This proves that a useful Claude Code importer is feasible on this Mac. It does **not** prove that every historical Claude Code session still exists: expired, deleted, non-persisted, cloud-only, or device-specific sessions can be absent.

### 1.3 Personal Claude Chat and Claude.ai Projects

For Free, Pro, and Max users, Anthropic supports a manual export from **Settings → Privacy → Export data**. Anthropic says this export includes conversation data and account user data, and sends a time-limited download link by email.[4]

The normal Messages API cannot fetch a user’s claude.ai history: it is stateless and requires the caller to submit the prior conversation history with each request.[5]

Claude’s own paid-plan chat search can search standalone chats together, but project chats are searched within each individual project. This is a conversational retrieval feature, not a documented bulk-export API, and incognito/deleted/retention-limited material has different behavior.[9]

Important unresolved point: the personal-export documentation does not document the archive schema or explicitly guarantee that project metadata, project knowledge files, artifacts, and chat-to-project mappings are all present. A real export fixture must be inspected before promising “Claude Chat & Projects import.”

### 1.4 Enterprise Claude

Claude Enterprise exposes chats, messages, uploaded files, generated files, artifacts, projects, and project attachments through the Compliance API with a scoped Compliance Access Key.[6] This is organization-wide compliance access, not a consumer-account integration. It should not be part of the first release.

### 1.5 Accurate product claim

Do not promise **“Import everything from Claude.”** Use:

> **Find portfolio-worthy work in the Claude sources available on this device or in an export you provide.**

| Source | Feasibility | Completeness boundary | Recommendation |
|---|---:|---|---|
| Claude Code local sessions | High | Only transcripts still retained on this device/config directory | Build first |
| Claude Desktop/Cowork local agent sessions | Medium | Separate stores and retention; not ordinary cloud Chat history | Add after Claude Code parser is stable |
| Personal Claude Chat/Projects | Medium via manual export | Export schema and project/file coverage must be verified | Spike with real export, then decide |
| Claude paid-plan chat search | Poor as an importer | Retrieval is scoped and not guaranteed exhaustive/structured | Do not use as the import backbone |
| Claude Enterprise Compliance API | High for eligible organizations | Enterprise-only, owner/admin/security burden | Separate later product connector |

---

## 2. Product decisions and corrections

### 2.1 Keep the daily skill; add a separate import skill

Do not turn the current `builders-diary` skill into a large importer. Preserve it as the fast end-of-session workflow. Add a second skill:

- `/builders-diary` — capture the current session.
- `/builders-diary-import` — discover and curate past work over a resumable multi-session workflow.

Reasons:

- The import flow has different permissions, privacy, cost, interruption, and failure behavior.
- It may run for hours or across days.
- It needs checkpoints and deduplication.
- A large import prompt would make the daily flow slower and less reliable.

### 2.2 Connect the Builder’s Diary folder before importing

The proposed step 8 places folder selection too late. Step 9 requires confirmed projects to appear in the web view immediately, so the output folder and browser permission must already exist.

Recommended order:

1. Install skills.
2. Connect the installer-created Builder’s Diary folder.
3. Start bulk import.
4. Write each confirmed project/card immediately.

Do not invent an arbitrary path. Keep the current installer default (`~/Documents/builders-diary` when available), then let the user approve that folder with the native picker.

### 2.3 Do not add “Objective” as a fourth persistent hierarchy yet

The current product model is `Project → lifecycle Section → Task`, and each task already has a one-line `purpose`. The proposed flow `Project → Objective → Task` conflicts with that model.

Recommended interpretation:

- During import, use **Workstreams** (or **Objectives**) as a temporary review grouping.
- The user confirms which workstreams matter.
- Final task cards retain their own `purpose` and are placed into `Think / Plan / Build / Review / Test / Ship / Reflect` sections.
- Do not create Objective folders or redesign the public UI in this release.

If Objectives must remain visible as a permanent second level, that is a separate four-level information-architecture decision and should be designed before importer implementation.

### 2.4 “Right-side webview” is a progressive enhancement, not a universal guarantee

A skill can write local files and start/open the web app, but it cannot guarantee the host client’s pane layout across Claude Code CLI, Claude Desktop, Cursor, Codex, and Antigravity.

Acceptance target:

- The portfolio updates within roughly two seconds after a confirmation while the web app is open.
- In clients with an embeddable preview, show it beside the chat.
- Otherwise, open the same web app in a browser and recommend side-by-side placement.

### 2.5 Correct the privacy copy before shipping import

The existing onboarding says “Everything stays on your computer.” That becomes misleading when historical excerpts are sent to an AI model.

The import UI must separate:

- **Local discovery:** filenames, IDs, dates, paths, and counts processed locally.
- **Model processing:** only user-approved minimized excerpts sent to the selected model/provider.
- **Local artifacts:** private digests, import checkpoints, and confirmed portfolio records saved locally.
- **Product server:** nothing uploaded unless the user separately approves sharing.

Suggested English copy:

> Discovery runs locally first. Only the work you approve for analysis is sent to your selected AI provider. Nothing is published without a separate confirmation.

---

## 3. Refined user journey

### Stage A — Set up local storage

1. User chooses AI clients used for daily capture.
2. Installer installs both `builders-diary` and `builders-diary-import` where supported.
3. User connects the installer-created Builder’s Diary folder.
4. Web app opens the empty/existing portfolio and offers a compact **Import past work** action.

### Stage B — Choose an import source

Source cards must be explicit, not one ambiguous “Claude” card:

- **Claude Code — Local sessions**
- **Claude Chat & Projects — Data export** (only after export support is proven)
- Later: **Claude Cowork — Local sessions**
- Later: **Claude Enterprise — Compliance API**

### Stage C — Discover without model use

1. Adapter scans source metadata read-only.
2. Show:
   - sessions found;
   - date range;
   - project/workspace paths found;
   - unreadable/corrupt/skipped count;
   - estimated analysis volume;
   - retention warning.
3. Let the user exclude folders, date ranges, or sessions before any model receives content.
4. Ask explicit analysis consent.

No raw conversation body is written into the chat at this stage.

### Stage D — Propose projects

1. Group sessions primarily by deterministic evidence:
   - transcript `cwd`;
   - repository root and remote, if still available;
   - explicit project/session titles;
   - stable source session IDs.
2. Use the low-cost model only to normalize names, describe likely projects, and suggest merges/splits.
3. Show a compact project table with session count, date range, and confidence.
4. User may keep, rename, merge, split, postpone, or drop candidates.
5. Confirm one project at a time.
6. On confirmation, create/update `project.json` through the existing storage helper so the web app shows the project immediately.

Unlike Codex’s migration, do not require the old workspace directory to still exist. Missing source folders should be marked as unavailable rather than causing historical work to disappear.

### Stage E — Curate each confirmed project

For each confirmed project, in sequence:

1. Build structured session digests from the selected source sessions.
2. Propose temporary **workstreams/objectives** with source-session counts and date ranges.
3. User keeps, renames, merges, splits, postpones, or drops workstreams.
4. For each retained workstream, propose task candidates.
5. Run the existing Builder’s Diary card gate:
   - choose lifecycle section;
   - review title and purpose;
   - review progress;
   - review highlight;
   - approve evidence visibility;
   - approve/edit/drop the complete card.
6. Save each approved card immediately.
7. Web app updates after each save.
8. Offer **Pause and continue later** after every project and every workstream.

### Stage F — Finish and add more later

1. Show completed, postponed, skipped, and failed counts separately.
2. Keep a resumable import record.
3. Portfolio remains usable even if only one project was imported.
4. A compact source-management control in the portfolio header lets the user:
   - add another source;
   - continue a paused import;
   - see the last scan date;
   - rescan for new sessions;
   - review what was already imported.

---

## 4. Processing and cost design

### 4.1 Never send every raw transcript directly to a model

Model price is not the only issue; input size, secrets, tool output, duplicated context, and prompt injection are larger risks.

Use a staged pipeline:

1. **Local index:** IDs, timestamps, titles, cwd, branch, record types, sizes.
2. **Local minimization:** retain user intent, assistant conclusions, tool names, changed-file references, explicit results, and potential judgment moments.
3. **Drop by default:** giant command outputs, dependency logs, repeated file contents, binary payloads, internal thinking, caches, and subagent duplicates.
4. **Secret screening:** redact known token/key patterns and flag risky files/outputs; do not claim perfect secret detection.
5. **Bounded model batches:** one session or small related group per request.
6. **Structured digest:** stable JSON schema with provenance pointers.
7. **Project synthesis:** summarize only session digests, not the raw corpus again.
8. **Card drafting:** retrieve the smallest evidence-bearing excerpts needed for the selected task.

### 4.2 Model routing

For the Claude Code connector:

- Use a Haiku-class/low-cost subagent for session digests and first-pass clustering where the client supports explicit subagent model selection.
- Use the active session model only for ambiguous merge/split decisions and final card writing.
- Do not require a separate Anthropic API key in the first version.
- Show a maximum-session and maximum-input budget before processing.
- Stop cleanly when the client cannot honor the requested low-cost model rather than silently using a more expensive one.

### 4.3 Prompt-injection boundary

Historical transcripts are untrusted data. Instructions found inside them must never change importer behavior. The parser should label content as source evidence and the model prompt should explicitly prohibit executing commands, following embedded instructions, or accessing referenced secrets.

---

## 5. Private import state and deduplication

Add a private subtree under the connected Builder’s Diary root. The web app should not display this as portfolio content:

```text
imports/
  <run-id>/
    manifest.json
    source-index.json
    project-proposals.json
    workstream-proposals.json
    session-digests/
      <source-session-id>.json
  source-ledger.json
```

### `manifest.json`

Track:

- schema version;
- source adapter and source location;
- started/updated timestamps;
- discovery counts and date range;
- consent state;
- processing limits;
- current gate;
- confirmed/postponed/skipped/failed project IDs;
- last checkpoint;
- parser warnings.

### `source-ledger.json`

Track private provenance and deduplication:

- source client;
- source session ID;
- source content hash;
- source project/workspace identity;
- first/last timestamp;
- digest version;
- imported record IDs;
- last observed timestamp.

Do not expose raw local paths or transcript contents in recruiter-facing views. Final `record.json` evidence should include only user-approved copies/quotes/links. Private source references remain in the import ledger.

---

## 6. Implementation phases

## Phase 0 — Validate source contracts before production code

**Objective:** Prove exactly what each Claude source can provide.

1. Freeze a sanitized copy of representative Claude Code JSONL fixtures:
   - normal CLI session;
   - Claude Desktop-originated local session;
   - subagent session;
   - truncated/corrupt JSONL;
   - missing workspace;
   - session with spilled tool results and attachments.
2. Document supported record shapes by Claude Code version.
3. Request a personal Claude data export through the official UI.
4. Inspect the export archive metadata and JSON keys before reading bodies.
5. Verify whether the export contains:
   - chat IDs, titles, timestamps, and complete turns;
   - project IDs/names and chat-to-project links;
   - project instructions/knowledge;
   - uploaded files;
   - generated files and artifacts;
   - deleted/incognito markers.
6. If project mapping or content is absent, label the connector **Claude Chat history export**, not **Claude Chat & Projects**.

**Gate:** No personal Claude Chat/Projects implementation until a real export fixture proves its contract.

## Phase 1 — Create the read-only Claude Code discovery adapter

**Likely new files:**

- `import-skill/SKILL.md`
- `import-skill/scripts/discover_claude_code.py`
- `import-skill/scripts/parse_claude_code.py`
- `import-skill/scripts/import_state.py`
- `tests/import/test_claude_code_discovery.py`
- `tests/import/test_claude_code_parser.py`

**Requirements:**

- Resolve default `~/.claude` and documented `CLAUDE_CONFIG_DIR` overrides.
- Scan only; never modify Claude state.
- Ignore credentials, settings values, caches, backups, and unrelated app databases.
- Distinguish main sessions, subagents, orphaned/superseded transcripts, and prompt-only history.
- Parse line by line with bounded memory.
- Preserve unknown fields without treating them as trusted instructions.
- Emit counts and warnings separately from imported content.
- Refuse unsafe/unknown schema changes with an actionable message.

**Commit:** `feat(import): add read-only Claude Code discovery`

## Phase 2 — Add minimized session digests and model budget gates

**Likely new files:**

- `import-skill/references/digest-schema.json`
- `import-skill/references/privacy-boundary.md`
- `import-skill/references/prompt-injection-policy.md`
- `tests/import/test_minimization.py`
- `tests/import/test_secret_screening.py`

**Requirements:**

- Local metadata preview before model calls.
- User scope selection and analysis consent.
- Deterministic transcript minimization.
- Explicit batch/session/input limits.
- Structured digest validation.
- Checkpoint after each completed session.
- Separate parse failure, model failure, and user postponement states.

**Commit:** `feat(import): add consented session digest pipeline`

## Phase 3 — Add project and workstream human gates

**Likely changed/new files:**

- `import-skill/SKILL.md`
- `skill/scripts/save_record.py`
- `tests/import/test_project_proposals.py`
- `tests/import/test_import_resume.py`

**Requirements:**

- Deterministic workspace grouping first; model-assisted naming second.
- Project keep/rename/merge/split/postpone/drop flow.
- Temporary workstream/objective proposals per confirmed project.
- Existing portfolio-project matching and duplicate protection.
- Add safe storage-helper operations for confirming an empty project before its first card.
- Every gate is resumable.

**Commit:** `feat(import): add project and workstream approval gates`

## Phase 4 — Reuse the current card approval workflow

**Likely changed files:**

- `import-skill/SKILL.md`
- `skill/scripts/save_record.py`
- `tests/import/test_card_projection.py`

**Requirements:**

- Project-scoped task candidate list.
- One-card-at-a-time approval.
- Existing lifecycle section confirmation.
- Existing purpose, progress, highlight, evidence, and body rules.
- Only approved cards enter the portfolio tree.
- Private source ledger records dedupe/provenance.

**Commit:** `feat(import): project approved history into diary cards`

## Phase 5 — Add incremental web status and source management

**Likely changed/new files:**

- `web/src/components/OnboardingScreen.tsx`
- `web/src/components/ImportSourceMenu.tsx`
- `web/src/components/ImportProgress.tsx`
- `web/src/app/home-content.tsx`
- `web/src/lib/fileSystem.ts`
- `web/src/lib/types.ts`

**Requirements:**

- All product UI copy remains English.
- Keep the source manager compact, preferably an icon-only header control with a popover.
- Separate daily client installation from past-work import sources.
- Read `imports/*/manifest.json` without treating it as public portfolio data.
- Poll only while an import is active; preserve the current focus/visibility rescan.
- Show confirmed portfolio nodes immediately.
- Show paused, partial, skipped, and failed states honestly.
- Replace the inaccurate local-only privacy statement.

**Commit:** `feat(web): show resumable import progress and sources`

## Phase 6 — Package and install the second skill

**Likely changed files:**

- `npm/bin/cli.js`
- `npm/package.json`
- `npm/README.md`
- `dist/builders-diary-import/**`

**Requirements:**

- Install daily and import skills independently but share the same data root.
- Do not overwrite user-edited skill files without the existing version/update behavior.
- Dry run lists every planned write.
- No client credentials or raw transcripts enter the npm package.

**Commit:** `feat(cli): install bulk-import skill`

## Phase 7 — Add personal Claude export adapter only after Phase 0 gate

**Likely new files:**

- `import-skill/scripts/discover_claude_export.py`
- `import-skill/scripts/parse_claude_export.py`
- `tests/import/test_claude_export.py`

**Requirements:**

- User chooses the downloaded archive; do not automate login, email, or the expiring download link.
- Extract into the private import run directory with path-traversal protection.
- Validate schema version and required fields.
- Preserve source IDs and chat-to-project mappings when present.
- Treat unsupported attachments/artifacts as explicit warnings.
- Never call the Messages API as a history-retrieval fallback.

**Commit:** `feat(import): add validated Claude export source`

---

## 7. Validation plan

### Automated parser and state tests

Run:

```bash
python3 -m unittest discover -s tests/import -p 'test_*.py' -v
```

Expected: all fixtures pass; no test reads the developer’s live `~/.claude` directory.

Coverage must include:

- current and legacy Claude Code JSONL shapes;
- unknown record types;
- corrupt/truncated lines;
- sessions with no title;
- missing old workspace;
- subagent duplication;
- spilled tool results;
- secret-like values;
- prompt injection text;
- interrupted run and resume;
- repeated scan without duplicate cards;
- changed source transcript after a prior import;
- no writes anywhere under `~/.claude`.

### Installer checks

Run:

```bash
node npm/bin/cli.js install --tools claude --dry-run
```

Expected: lists both skill destinations and reports that nothing was written.

Then run the installer with an isolated temporary `HOME`, not the real client configuration, and verify the generated marker and bound helper paths.

### Web checks

Run:

```bash
npm --prefix web run build
```

Expected: production build succeeds.

Manually verify:

1. Start with an empty connected data folder.
2. Begin a synthetic import.
3. Confirm one project; it appears before any task is approved.
4. Confirm one card; it appears within the active refresh interval.
5. Pause, reload, and continue from the same gate.
6. Add the same source again; no duplicate card is created.
7. Existing daily-created records render unchanged.
8. All visible UI text is English.

### Privacy and source-integrity checks

- Compare source-directory hashes/mtimes before and after the import; Claude source files must be unchanged.
- Confirm no raw transcript or private path appears in the public portfolio UI.
- Confirm no model request occurs before scope approval.
- Confirm the run reports exactly how many sessions were found, selected, processed, skipped, failed, and postponed.

---

## 8. Scope recommendation

### Now

- Keep the existing daily capture workflow.
- Build `builders-diary-import` for retained local Claude Code sessions.
- Add metadata-first discovery, consent, project gates, resumable workstreams, card gates, deduplication, and incremental web updates.

### Next, after a real export fixture

- Personal Claude Chat history export.
- Claude.ai Project mapping and attachments only if the export proves those fields exist.

### Later

- Claude Cowork local connector.
- Cursor and Codex local connectors.
- Enterprise Compliance API.
- Incremental background synchronization.
- Permanent Objective hierarchy, if user research proves it is needed.

### Not this release

- Browser automation against claude.ai private endpoints.
- Reading Electron cache/IndexedDB as the primary cloud-chat source.
- Asking Claude’s chat-search tool to impersonate a complete export.
- Automatic publication or server upload.
- Claiming complete history recovery.

---

## 9. Decisions to confirm before implementation

1. **Recommended:** First release supports **Claude Code local sessions only**; Claude Chat/Projects waits for export validation.
2. **Recommended:** Add a separate `/builders-diary-import` skill rather than expanding `/builders-diary`.
3. **Recommended:** Treat proposed Objectives/Workstreams as temporary import groupings; keep the public `Project → Section → Task` model.
4. **Recommended:** Use the connected default Builder’s Diary folder from the beginning, not after task generation.
5. **Recommended:** Use client-provided low-cost subagents when available; do not require a separate API key initially.
6. Decide whether the first importer should include subagent transcripts as evidence, ignore them by default, or surface them as expandable child activity. Recommendation: deduplicate them into the parent digest and keep them private unless they contain unique evidence.

## Sources

[1] https://developers.openai.com/codex/import — Import from another agent
[2] https://code.claude.com/docs/en/sessions — Manage Claude Code sessions
[3] https://code.claude.com/docs/en/claude-directory — Explore the .claude directory
[4] https://support.claude.com/en/articles/9450526-export-your-claude-data — Export your Claude data
[5] https://platform.claude.com/docs/en/build-with-claude/working-with-messages — Using the Messages API
[6] https://platform.claude.com/docs/en/manage-claude/compliance-content-data — Retrieve and delete chats, files, and projects
[7] https://code.claude.com/docs/en/data-usage — Claude Code data usage
[8] https://github.com/openai/codex/blob/2230d644/codex-rs/external-agent-migration/src/detect/sessions/cla.rs — Codex Claude session detector source
[9] https://support.claude.com/en/articles/11817273-about-memory — Claude chat search and memory
