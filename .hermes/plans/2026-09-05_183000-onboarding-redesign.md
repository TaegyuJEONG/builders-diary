# Onboarding Redesign — Folder-First, Detection-Driven, Client-Manageable

**Goal:** Rework the Builder's Diary web onboarding so it flows folder → skill install → auto-detected first record, with clear beginner-friendly copy, an OS-aware "open terminal" hint, and a way to add/change AI clients any time after onboarding.

**Architecture:** The web app is a pure static front-end. It reads the user's local `~/builders-diary/` folder via the File System Access API (browser sandbox — cannot create folders or read arbitrary paths without an explicit user pick). Onboarding state lives in `home-content.tsx`; the step UI lives in `OnboardingScreen.tsx`. We invert the current order (skill-first → folder-first) so the app can poll the connected folder and auto-advance when the skill writes its first record.

**Tech stack:** Next.js (app router), React client components, File System Access API + IndexedDB handle persistence, inline-style design tokens (`var(--*)`).

---

## Current State (verified from code)

- `home-content.tsx`
  - `connected` (bool) + `portfolio` drive the top-level render: `if (!connected || !portfolio) → <OnboardingScreen>` else `<Header/> + <CardTimeline/>`.
  - `handleConnect()` opens the folder picker, scans, then `doConnect()` → `setConnected(true)` **immediately jumps to the card view**. There is no "onboarding complete" concept separate from "folder connected". **This is the jump-to-webview bug.**
  - `?reset=1` clears `CONNECTED_KEY` and shows onboarding. `?demo=1` loads mock.
- `OnboardingScreen.tsx`
  - Two phases: `select` (pick clients) → `steps`.
  - Steps order today: **1 Install skill → 2 Connect folder → 3 First record**.
  - Step 2 calls `onSelectFolder` (= `handleConnect`), which sets `connected=true` in the parent → parent stops rendering `<OnboardingScreen>` → **user never sees step 3**.
  - Step 3 already polls the folder for a first record (`scanFolderStructure` every 3s) — good, we reuse this.
  - `installSnippet = npx builders-diary@latest install --tools <tools>` — correct, keep.

## Key Constraints (browser sandbox)

- **Cannot auto-create a folder.** The API always requires the user to pick/create in the native picker. So "we make a folder at an arbitrary path" is not possible from the web alone. Mitigation: suggest `~/builders-diary` in copy + let the `npx` step create it; the web only *connects* to it.
- **Cannot detect skill install directly.** `~/.claude/skills/` is outside any picked folder. We can only detect activity **inside the connected folder**. Therefore folder must be connected *before* we can auto-detect the skill's first write. → This is exactly why folder-first ordering is required.

---

## Target Flow (folder-first)

```
Phase A — Choose tools   (I use: Claude Code / Cursor / Windsurf / Codex …)
                          → feeds --tools; changeable later
Phase B — Steps
  Step 1  Connect your folder
          - Suggest ~/builders-diary
          - "Choose folder" opens native picker (user creates/selects)
          - On connect: DO NOT jump to cards; advance to Step 2
  Step 2  Install the skill
          - npx command (built from chosen tools) + Copy
          - OS-aware "open a terminal" hint (mac: Cmd+Space→Terminal, win: Win→cmd)
          - While here, poll the connected folder every 3s
          - When first record appears → auto-advance to Step 3 ("✓ detected")
  Step 3  Done → enter portfolio
          - Show the first record title, "View my portfolio →"
Post-onboarding
  - Header gets a "tools" icon → popover: connected tools + "add another" npx snippet
  - Onboarding considered COMPLETE only after user enters portfolio (new flag),
    so a plain folder connect no longer skips the guide
```

---

## Design Decisions

1. **Separate "folder connected" from "onboarding complete".** New state `onboardingDone` (persisted). Parent renders cards only when `onboardingDone === true`. Connecting a folder mid-onboarding no longer flips to card view.
2. **Empty folder + done → cards with a "Make your first record" banner overlay** (user chose "둘 다 보여주기"). So even after onboarding, an empty portfolio shows the card scaffold plus a dismissible banner.
3. **Client list is editable post-onboarding** via a header popover; adding a tool just re-shows the `npx … --tools <new>` snippet (npm makes this a one-liner; no config editing).
4. **Copy rewritten for non-developers** (plain language, no jargon like "stdio", "MCP").
5. **OS detection** via `navigator.platform` / `userAgentData` to pick the terminal hint.

---

## Files Likely to Change

- Modify: `web/src/app/home-content.tsx`
  - Add `onboardingDone` state + `ONBOARDING_DONE_KEY` localStorage.
  - `handleConnect` should NOT set the app into card-view during onboarding; only store the handle + report `folderConnected` up to `OnboardingScreen`.
  - Top-level render gate: cards when `onboardingDone`; else onboarding.
  - Add `onComplete()` passed to `OnboardingScreen` to set `onboardingDone=true`.
  - Keep `?reset=1` (also clear `ONBOARDING_DONE_KEY`).
- Modify: `web/src/components/OnboardingScreen.tsx`
  - Reorder steps: 1 Connect folder, 2 Install skill (+OS hint +poll), 3 Done.
  - Move the folder-connect button to Step 1; move the npx snippet to Step 2.
  - Add OS-aware terminal hint component.
  - On first-record detection, call `onComplete` (or show "enter portfolio" which calls it).
  - Rewrite copy.
- Modify: `web/src/components/Header.tsx`
  - Add a compact "tools" icon + popover (list selected tools, show add-tool npx snippet, copy).
  - Needs the selected tools available post-onboarding (persist `TOOLS_KEY`).
- Maybe add: `web/src/lib/os.ts` (tiny `detectOS()` helper returning 'mac' | 'windows' | 'linux').
- Maybe add: `web/src/components/FirstRecordBanner.tsx` (overlay banner for empty portfolio).

---

## Step-by-Step Plan

### Task 1: Add OS detection helper
**Files:** Create `web/src/lib/os.ts`
- Export `detectOS(): 'mac' | 'windows' | 'linux'` using `navigator.userAgentData?.platform` then `navigator.platform` fallback.
- Export `terminalHint(os)` returning `{ label, keys }` e.g. mac → "Open Terminal: press ⌘ + Space, type 'Terminal'".
**Verify:** import in a scratch and `console.log(detectOS())` in browser shows correct value on this Mac ('mac').

### Task 2: Persist selected tools
**Files:** Modify `home-content.tsx`, `OnboardingScreen.tsx`
- Add `TOOLS_KEY = 'builders-diary-tools'`. When user picks clients, save array to localStorage.
- On load, hydrate selected tools from storage (so header popover can show them later).
**Verify:** pick Claude+Cursor, reload, `localStorage['builders-diary-tools']` = `["claude","cursor"]`.

### Task 3: Introduce `onboardingDone` state (decouple from folder-connect)
**Files:** Modify `home-content.tsx`
- Add `const [onboardingDone, setOnboardingDone] = useState(false)` + `ONBOARDING_DONE_KEY`.
- Change top-level gate: `if (!onboardingDone) return <OnboardingScreen …/>` (folder can be connected inside onboarding without leaving it).
- Pass `onComplete={() => { setOnboardingDone(true); localStorage.setItem(ONBOARDING_DONE_KEY,'1'); }}`.
- `?reset=1` also removes `ONBOARDING_DONE_KEY`.
- Restore-on-load: if `ONBOARDING_DONE_KEY==='1'`, restore folder handle → portfolio → show cards.
**Verify:** connecting a folder mid-onboarding stays in onboarding; only clicking the final "enter portfolio" shows cards.

### Task 4: Reorder onboarding steps to folder-first
**Files:** Modify `OnboardingScreen.tsx`
- Step 1 = Connect folder (the "Choose Folder" button + suggested path text `~/builders-diary`). On success set internal `folderReady=true`, advance to Step 2. Do NOT complete onboarding here.
- Step 2 = Install skill (npx snippet + Copy + OS hint). Keep the existing 3s folder poll running while on Step 2.
- Step 3 = Done (first record detected or user clicks "I'll do it later → enter portfolio"), calls `onComplete`.
**Verify:** UI shows Connect → Install → Done in that order; folder connect advances to step 2 without leaving onboarding.

### Task 5: Wire first-record detection to auto-advance + complete
**Files:** Modify `OnboardingScreen.tsx`
- Existing poll: when `hasRecords`, set `firstRecord` and move to Step 3 automatically, show "✓ First record detected".
- Step 3 "View my portfolio →" calls `onComplete`.
- Add an escape hatch: "Skip for now →" on Step 2/3 that also calls `onComplete` (so users aren't trapped if detection lags).
**Verify:** with folder connected, drop a record via the skill (or `save_record.py`), onboarding auto-jumps to "detected" within ~3s.

### Task 6: Rewrite copy for non-developers
**Files:** Modify `OnboardingScreen.tsx`
- Replace terse/jargon strings. Examples:
  - Step 1: "Pick a folder where your work records will live. We suggest a new folder called builders-diary in your home directory."
  - Step 2: "Open a terminal and paste this. It teaches your AI tool the @builders-diary command." + OS hint line.
  - Step 3: "That's it — your first card is in. This is what recruiters will see."
**Verify:** visual review at localhost:3111 (folder-first, plain language).

### Task 7: Empty-portfolio banner overlay
**Files:** Create `web/src/components/FirstRecordBanner.tsx`; Modify `home-content.tsx`
- When `onboardingDone` but portfolio has 0 records, render `<CardTimeline/>` scaffold plus a top banner: "No cards yet — type @builders-diary in your AI tool to add your first." with a Copy button for `@builders-diary`.
- Dismissible (session state).
**Verify:** connect an empty folder, finish onboarding → cards view shows the banner; after a record appears (refresh), banner gone.

### Task 8: Header tools popover (add/change clients any time)
**Files:** Modify `web/src/components/Header.tsx`
- Add a compact icon button (e.g. a small "tools"/plug glyph) → popover:
  - Lists currently selected tools (from `TOOLS_KEY`).
  - "Add a tool" mini-selector → shows `npx builders-diary@latest install --tools <tool>` + Copy.
- Match existing compact/icon+popover style used elsewhere in Header.
**Verify:** after onboarding, click the icon → see tools, pick Windsurf → snippet shows `--tools windsurf`, Copy works.

### Task 9: Type-check + visual pass + build
**Files:** none (validation)
- Run `npx tsc --noEmit` in `web/` → expect 0 errors.
- Visual: `localhost:3111?reset=1` → walk Connect → Install → Done; then header popover.
- `npx next build` (only when dev server stopped) → expect success, all static. Restart dev after.
**Verify:** clean type-check, flow works end-to-end locally.

### Task 10: Commit
- `git add web/ && git commit -m "feat(web): folder-first onboarding with detection, OS hints, tool management"`.

---

## Tests / Validation

- No unit test harness in `web/` today; validation is `tsc --noEmit` + manual browser walkthrough + `next build`.
- Manual acceptance checklist:
  - [ ] Folder connect during onboarding does NOT jump to cards.
  - [ ] Steps render in order Connect → Install → Done.
  - [ ] npx snippet reflects chosen tools.
  - [ ] OS hint matches platform (mac shows ⌘+Space).
  - [ ] First record auto-detected within ~3s → onboarding completes.
  - [ ] "Skip for now" escape hatch works.
  - [ ] Empty portfolio shows first-record banner.
  - [ ] Header popover lists tools and shows add-tool snippet.
  - [ ] `?reset=1` returns to Connect step.

## Risks / Tradeoffs / Open Questions

- **Detection false-negatives:** if the user connects folder A but the skill writes to `~/builders-diary` (folder B), detection never fires. Mitigation: Step 1 copy strongly suggests the same `~/builders-diary` path the skill defaults to; keep the "Skip for now" escape hatch.
- **Permission re-prompts:** File System Access handles can lose permission; on restore we already re-verify. Keep graceful fallback to Connect step.
- **`next build` vs running `next dev`:** building overwrites `.next` and 500s the dev server (known issue). Always stop dev before build, `rm -rf .next`, restart. Prefer `tsc --noEmit` for routine checks.
- **Not in scope (later):** mock chat demo animation showing @builders-diary being typed; onboarding→webview transition video; true one-click folder auto-provisioning (blocked by browser sandbox).
- **Open question:** should the header tool manager also *remove* a tool (delete the skill copy)? Removal needs a shell command too (`rm -rf ~/.claude/skills/builders-diary`); may be out of scope — confirm before building Task 8's remove path.
