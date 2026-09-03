# Builder's Diary V1 — Engineering Review

**Reviewer**: Engineering Manager (peer-level technical assessment)  
**Date**: 2026-09-03  
**Target Launch**: 2026-09-08 (5 days from review)  
**Timeline Budget**: 4–6 days

---

## Executive Summary

**This is launchable in 5 days, but not at the current scope.** The architecture is sound; the risk isn't "can this work" but "will it stay working during integration." You have one hard dependency (MCP Server behavior under multiturn state), two unvalidated browser assumptions, and a timeline that leaves almost no buffer. I'd recommend starting today and cutting one of the three risky components.

**Verdict**: Feasible. High execution risk due to timeline + unknown unknowns in MCP deployment. Not recommended to ship without Day 5–6 validation loop.

---

## 1. ARCHITECTURE REVIEW

### The MCP Server + Connector + Local Folder Model

**Is it realistic for 4–6 days? Mostly, but with caveats.**

**What's sound:**
- MCP Server as a bounded, single-purpose tool (extract context → propose structure → write files) is the right call. You're not building a database, a web service, or a deployment infrastructure. You're building a CLI with LLM decisions baked in.
- File System Access API for local storage skips database entirely, which is correct for V1. The browser gets permissions once; subsequent visits use cached access.
- Markdown + YAML front matter is standard, well-tested. Parsing libraries exist. No invention needed.

**What's unvalidated:**
1. **MCP Server deployment for Claude Connectors**: You wrote "deployed via Claude Connectors" but didn't specify *where it runs*. 
   - If it's local (dev machine), you're good for testing. But Claude Connectors talk to public internet endpoints, not localhost. If you expect the Connector to call your server, it must be reachable over the network.
   - If you deploy to a server (AWS, Vercel, etc.), you add complexity: environment setup, async file I/O, secrets management (folder path).
   - If it stays on your machine, Connectors can't reach it when you're not in the IDE. The skill won't be available.
   
   **Question for you**: Where does the MCP server run when you use it? If it's local-only, you've built a tool for yourself in the IDE, not a "skill you call later." That's fine—but reframe it. If it's meant to be cloud-deployed, you're adding 1–2 days for infrastructure.

2. **Multiturn state management**: The design says "CLI-like sequential confirmation" but doesn't explain how the MCP Server maintains conversation state across 5–7 turns. 
   - MCP Servers are stateless; they don't hold conversation history by default.
   - If you're relying on Claude (the LLM) to keep context, that's correct, but the MCP Server needs to *receive* all prior turns in each request, not cache them.
   - If you're storing state in-memory on the server, it will evaporate if the process restarts (which Claude Connectors can do).
   - **Confirm**: Are you persisting state anywhere, or does the MCP Server only see the full message history each call?

3. **File System Access API + Local Folder**: This is browser-only and won't work from the MCP Server (which may be running on a different machine). 
   - If the MCP Server is meant to *write* files directly to the user's folder, it needs SFTP, WebDAV, or cloud sync (AWS S3, Dropbox API, etc.). File System Access API is a browser feature.
   - If the MCP Server generates the file and Claude Connectors *download it* for the user to save locally, that's an extra step, but it works.
   - **Clarify**: Who writes the file? Server or browser?

**Risk assessment**: 🔴 **MEDIUM-HIGH**. The deployment model is underspecified. You might spend 2 days discovering the server can't reach your local folder, or Connectors can't reach the server when you're offline.

---

### Deployment Model

**Vercel (web) + ??? (MCP Server)**

You have Vercel for the website. Where does the MCP Server go?

**Options:**
- **Local + Claude Desktop**: Run MCP Server on your machine, connect via Claude Desktop (not Connectors). Works offline. No cloud cost. Scope: 1 day. **Limitation**: Only works when your machine is on.
- **Vercel Functions**: Deploy MCP Server logic as serverless functions. Works globally. Adds cold-start latency, but manageable. Scope: +1 day (environment setup, secrets, testing). **Cost**: Free tier ~$0, production ~$20/month.
- **AWS Lambda + environment setup**: Most flexible. Most setup work. Scope: +2 days.
- **Supabase Edge Functions**: Middle ground (Vercel's equivalent). Scope: +1 day.

**My recommendation**: Use **Claude Desktop + local MCP Server** for V1. It's the fastest path and it works. Connectors can come in V2 when the UX is stable. Tell users: "Run the server locally; it talks to Claude."

This cuts scope by 1 day and removes the "MCP Server where?" risk entirely.

---

### Risks: What Breaks First?

In rough order of likelihood:

1. **File System Access API browser support + permissions caching** (High)
   - Chrome/Chromium: Full support. ✅
   - Firefox: Partial support (only manual file picks, not directory access). ⚠️
   - Safari: No support as of 2026-09. ❌
   - Edge: Full support (Chromium-based). ✅
   
   **Impact**: Users on Safari see a dead feature. The fallback is "select files manually" or "no local access."
   
   **Mitigation**: 
   - Detect support at load time. Show a warning: "This app works best on Chrome/Edge."
   - Offer fallback: file upload for power users.
   - **For V1**: Accept that Safari users don't get the local folder feature. Document it.

2. **Multiturn conversation state in MCP + Claude** (High)
   - If state isn't persisted, the third turn might lose context from turn 1.
   - **Mitigation**: Test with a 7-turn flow end-to-end before shipping. 1 day before launch.

3. **File parsing edge cases** (Medium)
   - YAML front matter with special characters (quotes, colons, unicode).
   - Markdown with nested code blocks.
   - Long record titles or tags with spaces.
   - **Mitigation**: Use a tested parser (e.g., `gray-matter` for Node, `python-frontmatter` for Python), not regex. Your design already mentions this. Stick to it.

4. **Folder permissions revoked mid-session** (Low)
   - User visits website, grants permission, then OS revokes it (happens on file deletion or OS updates).
   - Website becomes unusable until re-grant.
   - **Mitigation**: Graceful error message. "Grant permissions again" button. 1-hour work, do it on Day 5.

5. **Large folder scanning performance** (Low in V1, High in V2+)
   - If the user's portfolio folder has 10K files, the browser might hang scanning it.
   - **Mitigation**: Add pagination/lazy loading if it becomes a problem. V1 scope: scan up to 1K files; show a warning if there are more.

---

## 2. TECHNICAL STACK VALIDATION

### MCP Server: Python or Node.js?

**Choose Python if:**
- You want to use Claude API directly (simpler auth).
- You're comfortable with Python.
- You want to ship in 2 days.

**Choose Node.js if:**
- You want File System SDK integrations (for cloud storage later).
- You're more comfortable with JS.
- You want the server to talk to Vercel Functions (same ecosystem).

**My call**: **Python**. You've listed Python as the tech; you likely have the environment. MCP SDK for Python is mature. One less context switch.

**Tech choice specifics:**
- Python 3.11+, MCP SDK via pip.
- `anthropic` SDK for Claude calls (built-in token counting, so you know where you are on context window).
- `python-frontmatter` for markdown parsing.
- `pathlib` for file I/O (local, no async needed for V1).
- **No FastAPI, no Flask for V1.** Just MCP. Simple.

---

### Frontend: Next.js 14 + React 18 — Sufficient?

**Yes, overkill, but that's fine.**

Next.js 14 gives you:
- File System Access API integration (straightforward).
- localStorage for caching permissions.
- Server Components if you want them later.
- Built-in markdown library support.

**Specific stack for V1:**
- `remark` + `remark-react` for markdown → React components.
- `react-tree` or equivalent for the 3-layer tree UI (don't build from scratch).
- `zustand` or React Context for UI state (folder selected, current project, etc.). Keep it simple.
- CSS: Tailwind or vanilla. You're shipping one page; don't over-engineer.

**What to avoid:**
- Server-side rendering for the portfolio page (defeats the purpose of local-only access).
- Real-time syncing frameworks (Firebase, etc.).
- Authentication middleware.

---

### File Parsing: Markdown + Front Matter — Complexity vs. Payoff?

**Payoff: 9/10. Complexity: 3/10.**

Markdown is text-friendly (version control, human-readable). Front matter in YAML is standard for static site generators. Tools exist:
- Node: `gray-matter`, `remark`, `marked`.
- Python: `python-frontmatter`, `markdown2`, `front-matter`.

**Payoff**: 
- Markdown renders natively in browsers (with `remark-react`).
- YAML is unambiguous, human-editable if needed.
- No schema validation; flexibility for future fields.

**Complexity**: 
- Parsing is solved. No DIY regex.
- Biggest risk: special characters in front matter. Use a tested library.

**Recommendation**: Use `gray-matter` (Node.js) or `python-frontmatter` (Python). One dependency each. Don't invent.

---

### Database: None in V1 (Local Only) — Scaling Constraint?

**This is fine for V1. Real constraint in V2.**

**Why none is correct for V1:**
- You're the only user.
- Folder is the source of truth.
- No need for backup, replication, or search indices.
- Deployment is free (just the website).

**Why it will fail in V2:**
- When you add sharing, multiple users mean multiple folders → no single source of truth.
- Conflict resolution becomes hard (two users edit the same record).
- Search across 1M records becomes slow (no full-text index).

**V1 design is honest here**: Local folder + static visualization. Once you need sharing or multi-user, you rebuild. That's a V2 project, not a scope creep for V1.

**Constraint accepted**: ✅ By design, not by accident.

---

## 3. TIMELINE REALISM

### Day 1–2: MCP Server (2–3 days claimed)

**What's in scope:**
- LLM integration (call Claude API, get extraction).
- CLI flow (5–7 sequential prompts, store responses).
- File I/O (create folder structure, write markdown with front matter).
- Testing (manual walk-through of one full flow).

**Realistic estimate: 1.5–2 days if:**
- You've done MCP before. ✅ (You have.)
- You've used Claude API before. ✅ (You have.)
- You're not perfecting the LLM prompt. ⚠️ (Don't.)

**Where it bleeds over:**
- Tuning the LLM extraction prompt (can take 3–4 iterations, especially for tag suggestions). 
  - **Mitigation**: Ship with a simple prompt; iterate in V1.1.
- Folder structure edge cases (if project slug has special characters, if goal already exists, etc.).
  - **Mitigation**: Pre-compute folder paths; error handling is 30 mins.
- Testing multiturn state.
  - **Risk**: This might reveal a bug on Day 2 evening. No time to fix if it's a design flaw.
  - **Mitigation**: Do a full 7-turn walkthrough on Day 2 afternoon, not Day 3.

**Verdict: 2 days is tight, but realistic if you start today (Day 1) and don't debug the LLM prompt to perfection.**

---

### Day 2–3: Connector + Testing (1 day claimed)

**What's in scope:**
- Register MCP server with Claude Connectors (or Claude Desktop if going local).
- Test skill invocation from Claude/ChatGPT/Cursor.
- Test file creation on disk.
- Test CLI flow end-to-end (pick project → pick goal → enter title → tag → write file).

**Realistic estimate: 1 day if:**
- You're using Claude Desktop (not Connectors). ✅ Simpler.
- You have a clear test case (your own work). ✅ (You do.)

**Where it breaks:**
- If files don't get created, is it the MCP server, Claude's API call, or your file I/O? Debugging takes time.
- If tags don't persist, is it YAML parsing? File corruption? Need to walk through the full round-trip.
- Permission errors (folder doesn't exist, user lacks write access).

**Verdict: 1 day is realistic if the MCP server works; 2 days if there's a bug.**

---

### Day 3–4: Website + File System API (1–2 days claimed)

**What's in scope:**
- File System Access API integration (request permission, get folder handle).
- Folder scanning (recursive walk, find all `.md` files).
- Markdown parsing + rendering.
- 3-layer tree UI (projects → goals → records).
- localStorage for caching folder handle + permissions.
- URL parameter handling (`?folder_access=true`).

**Realistic estimate: 1.5–2 days if:**
- You use a tree UI library (e.g., `react-tree`, not building from scratch). ✅ Smart choice.
- Markdown parsing is off-the-shelf (`gray-matter`, `remark`). ✅ (Your plan.)
- You ship a minimal first pass (tree + titles, no "expand to see details" yet).

**Where it bleeds:**
- File System Access API has quirks (permissions, handle serialization, error states).
  - **Testing**: Takes 1–2 hours of trying different scenarios (grant → revoke → grant again).
- Tree rendering with 100+ files might have perf issues. Need to test.
  - **Mitigation**: Pagination or virtualization if it's slow. Day 4 catch-all.
- Markdown rendering edge cases (code blocks, tables, images).
  - **Mitigation**: Render the subset of markdown you use (no rare features yet).

**Verdict: 1.5 days is realistic; 2 days if you hit File System API quirks.**

---

### Day 5–6: Buffer + Testing

**Timeline so far:**
- Days 1–2: MCP = 2 days. Done Day 2 EOD.
- Days 2–3: Connector + testing = 1 day. Done Day 3 EOD.
- Days 3–4.5: Website = 1.5 days. Done Day 4 EOD + morning Day 5.

**Days 5–6: Integration + edge cases + shipping.**

**What goes here:**
- E2E test: Call skill → check file → load in website → verify tree display. (3 hours)
- Edge cases: Special characters in tags, large tags list, missing goals folder, etc. (2 hours)
- UI polish: Error messages, loading states, empty states. (2 hours)
- Deployment: Vercel + domain setup. (1 hour)
- Day 6: Buffer for bugs discovered in E2E.

**Verdict: 1 day buffer is *barely* enough.** If a critical bug surfaces on Day 5, you'll ship with a known issue or cut scope.

---

### Critical Path Analysis

**Longest pole**: MCP Server + multiturn state validation.

Why?
- Everything else (website, parser, tree UI) is off-the-shelf or straightforward.
- MCP multiturn state is unknown. If Claude doesn't persist context correctly, you'll discover this on Day 2 afternoon and have to redesign the flow.
- You can't parallelize this; the website depends on knowing how files are structured, which the MCP server defines.

**Dependency order:**
1. MCP server structure defined (Day 1 AM).
2. Test one full 7-turn flow (Day 1–2 PM). ← **Critical gate**.
3. If it works, proceed in parallel: connector registration + website dev.
4. If it doesn't, redesign flow (possibly add short-term state storage on the client).

**Recommendation**: Do not start website development until you've done a full end-to-end walk of the MCP server on Day 1. If that test fails, everything shifts.

---

## 4. DEPENDENCIES & ORDERING

### Can MCP & Website Be Built in Parallel?

**Technically**: Sort of. **Practically**: No, not fully.

**What can be parallel:**
- Website file I/O + folder scanning (doesn't depend on MCP).
- Website tree UI rendering (doesn't depend on MCP).
- URL parameter handling (doesn't depend on MCP).

**What must be serial:**
- **Testing integration** (you need a real MCP server to test website against).
- **File format validation** (website parser must match server's output format).

**Recommendation**: 
1. Day 1: MCP skeleton (can it create a valid markdown file?). ~4 hours.
2. Day 1 PM: Website skeleton (can it read a local markdown file?). ~4 hours.
3. Days 2–3: Deep work in parallel if Day 1 tests pass.
4. Day 4: Integration testing (server → file → website).

This saves time. You're not locked into serial development.

---

### File System Access API: Browser Testing Requirements?

**Yes, but only on Day 4.**

This API is stable in Chrome/Edge, so you don't need cross-browser testing for V1 ship. But you do need to test:

1. First grant (user selects folder, gives permission). 
2. Subsequent visits (permission persists, no re-grant).
3. Revoke + re-grant (user changes mind).
4. Folder deleted (permission valid, but folder gone).

**Timeline**: 2–3 hours. Do it during integration testing (Day 4).

---

### Connector Registration: When in the Timeline? (Blocker?)

**Not a blocker if you use Claude Desktop.**

If you're going local MCP Server:
- Registration is just adding the server config to `~/.claude/config.json` (or wherever you store it).
- Takes 5 minutes.
- Do it on Day 2 when MCP server is ready.

If you're going cloud-deployed MCP (e.g., Vercel Functions):
- Registration includes making the endpoint public + auth setup.
- Takes 1–2 hours.
- Do it on Day 2, after server is deployed.

**Recommendation**: Use Claude Desktop for V1. Skip Connectors entirely. Registration becomes: "Here's the server, run it locally."

---

## 5. RISKS & MITIGATIONS

### Risk 1: File System Access API Browser Support (Safari / Firefox)

| Browser | Support | Impact |
|---------|---------|--------|
| Chrome | ✅ Full | Works out of the box. |
| Edge | ✅ Full | Works out of the box. |
| Firefox | ⚠️ Partial | Only manual file picks, not directories. Website doesn't work. |
| Safari | ❌ None | Website doesn't work. |

**Impact for V1**: You lose 25–30% of potential users (Safari + Firefox).

**Mitigations**:
1. **Detect + warn** (2 hours, do on Day 5): Show banner on unsupported browsers. "This app works best on Chrome/Edge."
2. **Fallback upload** (1 day, V1.1): Let users upload a zip of their portfolio folder. Not ideal, but it works.
3. **Ship with caveat** (now): "Chrome/Edge only for V1. Safari support coming soon."

**Recommendation**: Accept the limitation for V1. Document it. Move to V1.1 if Safari users complain.

---

### Risk 2: MCP Server Deployment (Local vs. Cloud)

**Scenario**: You're working locally. Claude Connectors are in the cloud. They need to talk to your MCP server. Where does it live?

| Option | Works? | Setup | Cost | Notes |
|--------|--------|-------|------|-------|
| Local (your machine) | ✅ Yes, offline | 5 min | Free | Only works when machine is on. Good for V1 testing. |
| Vercel Functions | ✅ Yes, always-on | 2 hours | Free (tier), ~$20/mo prod | Global, but cold starts. Good for V2. |
| AWS Lambda | ✅ Yes | 3 hours | Free tier, ~$1/mo prod | Most control. Overkill for V1. |
| Cloud + sync | ✅ Yes | 4 hours | ~$10/mo | Files auto-sync (AWS S3, Dropbox). Safest but complex. |

**Impact if wrong**: 
- If local, you can't use the skill when your machine is off.
- If cloud, you're adding 2 hours of setup + debugging environment + testing.

**Recommendation**: **Local MCP on Claude Desktop for V1.** Simplest path. Zero infrastructure. Ship it.

```
MCP Server runs: ~/.local/bin/builders-diary-mcp
Claude Desktop config: /Users/taegyujeong/.claude/config.json
Invocation: Open Claude Desktop → /builders-diary
```

This is the fastest ship and you get feedback in real usage immediately.

---

### Risk 3: Multiturn Conversation State

**Problem**: The skill has 7 turns (project → goal → title → tags → confirmation → write → done). If Claude forgets turn 1 by turn 5, the record is wrong.

**How Claude MCP works:**
- Each turn, Claude sends the full message history to the MCP server.
- MCP server is stateless; it reads the history and responds.
- As long as Claude keeps the history (which it does by default), state is preserved.

**Real risk**: If you save intermediate state locally (e.g., project name in the MCP server's memory) and restart the server mid-conversation, that state is lost.

**Mitigation**:
1. **Don't store state on the server.** Read everything from the message history each turn.
2. **Test a full 7-turn flow on Day 2**, confirming every turn sees prior context.
3. **If state is lost**, you'll know by Day 2 PM and can redesign to pass state as parameters.

**Verdict**: This is testable before shipping. Do it.

---

### Risk 4: Error Handling — User Denies Folder Permission

**Scenario**: User visits website, clicks "Select Folder," grants permission, works for 2 hours, then denies it (accidentally or intentionally). Website becomes unusable.

**Current design**: Doesn't address this.

**Impact**: User is stuck. They have to reload the page and re-grant. Not terrible, but poor UX.

**Mitigation** (2 hours, Day 5):
1. Detect permission errors when accessing files.
2. Show error: "Permission denied. Grant access again?"
3. Button to re-request permission.
4. localStorage cleanup if permission is revoked.

**Recommendation**: Add error handling on Day 5 morning. It's a 2-hour job and prevents user confusion.

---

### Risk 5: Large Folder Performance

**Scenario**: User's portfolio folder has 1,000 records spread across 10 projects. Website tries to scan all of them on load. Browser hangs.

**Impact**: Website is unusable for large portfolios.

**Current design**: Doesn't mention pagination or lazy loading.

**Mitigation**:
1. **Scan limit**: Load up to 500 files. Show warning if there are more. (30 mins, do on Day 4)
2. **Lazy loading**: Load goals on demand when user expands a project. (2 hours, do on Day 5 if time)

**Verdict**: Acceptable for V1 (your portfolio won't have 1K records yet). Add pagination in V1.1 if needed.

---

## 6. OUT-OF-SCOPE VALIDATION

### Is Everything Listed as Out-of-Scope Realistic to Defer?

Reading the design doc, out-of-scope items are:
1. ✅ **Sharing**: Deferred to V2. Correct. You don't need it to validate the core loop (capture → visualize).
2. ✅ **Multi-user**: Deferred to V2. Correct. Only you are using it in V1.
3. ✅ **Recruiter dashboard**: Deferred to V3. Correct. A link is enough for V1.
4. ✅ **Database backend**: Deferred to V2. Correct. Local folder is sufficient for V1.
5. ✅ **User auth**: Deferred to V2. Correct. No login needed if you're the only user.
6. ✅ **Platform**: Deferred to V2+. Correct.
7. ✅ **Full-text search**: Deferred to V2. Correct for V1 (tags are enough).
8. ✅ **Auto-detection / nudges**: Deferred to V2. Correct. Manual invocation is fine.

**Verdict**: All deferral decisions are sound. No hidden V2 scope leaking into V1. ✅

### Hidden Dependencies?

Going through the PRD and design doc:

- **Manifest/config file for projects?** Design mentions optional `_metadata/config.json`, but says data is derived from folder structure. **No hard dependency.** ✅
- **Screenshots / code snippets as proof?** PRD mentions them, but design says they're in the record body, not separate files. **No infrastructure needed.** ✅
- **Tag vocabulary?** 200+ existing tags mentioned. You need to provide a list or let users free-form. **This is a 2-hour decision, not blocking.** ⚠️ (See Section 8.)
- **UI polish / branding?** Design shows wireframe. Real CSS hasn't been done. **1 day for visual polish, not in your timeline.** ⚠️ (Cut from V1.)

**Hidden scope to cut**:
- **Visual polish**: Ship with basic CSS (Tailwind defaults). Color + logo + spacing can wait for V1.1.
- **Tag vocabulary completeness**: Ship with an empty tag list. Let users add tags free-form. Auto-suggest comes in V2.

---

## 7. SUCCESS METRICS

### "Builder Keeps Using It"

**How will you measure?**

Current plan: "9월 8일 이후 2주간 패턴으로 확인" (check pattern over 2 weeks after launch).

**Metrics you can track:**
1. **File count**: How many records created per week?
2. **Creation dates**: Are they spread across days, or clustered?
3. **Website visits**: How often do you open the portfolio page?
4. **Git commits**: (If you back up the folder to Git) Commits over time.

**Concrete success threshold** (suggest):
- **By 2026-09-15** (1 week post-launch): 5+ records created.
- **By 2026-09-22** (2 weeks): 15+ records, spread across at least 10 days.
- **By 2026-10-01** (3 weeks): Active usage pattern (2–3 records/week minimum).

If those numbers are hit, it's working. If not, you'll know by mid-September.

**Recommendation**: Set up a simple tracker (e.g., cron job that counts `.md` files weekly). Makes success/failure objective.

---

### "Portfolio Good Enough for Resume"

**How will you judge?**

Current plan: Subjective ("느껴지는가" — do you *feel* it's good?).

**Make it more concrete:**
1. Pick 3 records you create in the first week.
2. Ask someone (peer, mentor, recruiter) to read them blind (don't say they're AI-generated).
3. Ask: "Would you click this? Does it tell you what they know?"
4. If yes → portfolio is working. If no → records need more narrative depth.

**This is in PRD 12.2** (verifying "does agent-written narrative work?"). Do it by 2026-09-15.

**Recommendation**: Don't ship with a guess. Ship with a test result.

---

## 8. RECOMMENDATIONS

### One Thing to Start With First

**Do a full MCP server skeleton on Day 1, before anything else.**

Specifically:
1. Create one record from a dummy conversation.
2. Verify file structure is created correctly.
3. Verify YAML front matter parses correctly.
4. **Test all 7 turns of the CLI flow, with Claude context preserved.**

If this works, you can parallelize website development.
If this breaks, you'll know by Day 1 evening and can redesign.

**Timeline**: 4–6 hours. Do it today.

---

### One Thing to Be Careful About

**Multiturn state in MCP Server + Claude Connectors.**

This is where you'll lose a day if something is wrong. The problem:
- It's hard to debug (interaction between Claude's API, MCP protocol, your code).
- It's not testable until you have all three working together.
- Discovering a design flaw on Day 2 evening means redesign on Day 3.

**How to be careful:**
1. **Write it simply.** No local caching, no session state. Just read the message history.
2. **Test early.** Day 1, not Day 2.
3. **Have a backup plan.** If multiturn breaks, can you do single-turn with the user providing context? (Yes, but it's worse UX.)

**Backup plan if multiturn fails**: Switch to a "review mode" where Claude shows the proposed structure, user says "yes/no/revise," and Claude regenerates. One turn instead of seven.

---

### Scope Cuts to Make Deadline Safer

If you hit snags and need to cut scope, cut in this order (by priority of importance):

#### Cut 1: Visual Polish (Save: 1 day)
- Ship with basic Tailwind CSS, no custom branding.
- No animated transitions, no dark mode toggle.
- Do it in V1.1 if launch is at risk.

#### Cut 2: Tag Auto-Suggest (Save: 1 day)
- Ship with free-form tags. Users type what they want.
- LLM can still propose tags on creation (that's in the MCP server).
- Don't implement tag search/filtering in the website yet.
- Do it in V1.1.

#### Cut 3: File System Fallback Upload (Save: 1 day)
- Ship local-folder-only. No fallback for Safari/Firefox.
- Warn users: "Chrome/Edge only."
- Add upload later.

#### Do NOT Cut (Scope-critical):
- ❌ MCP Server (can't capture without it).
- ❌ File I/O + markdown generation (core feature).
- ❌ Website tree UI (core feature).
- ❌ File System Access API integration (core feature).
- ❌ Basic E2E test (core validation).

**Fallback scope for emergency launch**:
- Day 1–2: MCP Server (capture + write).
- Day 3–4: Website (tree UI + read markdown).
- Day 5: Deploy + test.
- Skip: polish, tags, fallback, branding.

This is still a working product. Bare-bones, but working.

---

## 9. VALIDATION CHECKPOINTS

Use these to stay on schedule:

| Day | Checkpoint | Pass/Fail | If Fail |
|-----|-----------|-----------|---------|
| Day 1 EOD | MCP server creates valid markdown + full 7-turn test | ✅ or 🔴 | Redesign flow (Day 2 AM). Delay website start to Day 2. |
| Day 2 EOD | Connector registration works + skill callable from Claude | ✅ or 🔴 | Debug connector setup (Day 3 AM). Website start pushed to Day 3. |
| Day 3 EOD | Website loads folder, parses markdown, renders tree | ✅ or 🔴 | Debug File System API (Day 4 AM). Cut polish scope. |
| Day 4 EOD | E2E test: skill → file → website display | ✅ or 🔴 | Identify integration issue (Day 5). Fix + retest. |
| Day 5 EOD | Edge case testing (permissions, special chars, errors) | ✅ or 🔴 | Hotfix (Day 5 PM). Ship with known issue if necessary. |
| Day 6 EOD | Deploy to Vercel + test live | ✅ or 🔴 | Rollback or patch (Day 7 AM). |

If any checkpoint fails, stop and fix before proceeding. Don't compound the delay.

---

## 10. FINAL VERDICT

### Can You Ship on 2026-09-08?

**Yes, with caveats.**

### Risk Level

| Category | Risk | Confidence |
|----------|------|------------|
| Architecture | Medium | 7/10 (MCP deployment underspecified) |
| Timeline | Medium-High | 6/10 (1 day buffer is thin) |
| Technology | Low | 9/10 (all pieces are proven) |
| Integration | Medium | 6/10 (multiturn state untested) |
| Browser Support | Medium | 7/10 (Safari/Firefox gaps) |

### What Could Go Wrong

1. **Multiturn state breaks on Day 2** → 1-day redesign. Launch slips to 09-09.
2. **File System API quirks take 3 hours each** → Day 4 bleeds into Day 5. Launch still possible, but no buffer.
3. **Browser support headache** → Fallback code + testing eats 1 day. Launch slips, or ship with Safari warning.
4. **Edge cases in parsing** (special chars, large files) → 3–4 hour debugging. Launch still on track.

### What Needs To Happen Today

1. **Confirm MCP deployment strategy.** (Local MCP + Claude Desktop recommended.)
2. **Start MCP server skeleton.** Test one full 7-turn flow by end of day.
3. **Parallel: Start website skeleton.** Test File System API on your machine.
4. **Set success metrics.** Decide how you'll measure "it works" by 2026-09-15.

### Recommended Changes to Design

1. **Deploy MCP locally (Claude Desktop), not via Connectors.** Saves 2 days of infrastructure setup.
2. **Cut tag auto-suggest from V1.** Let users type tags freely. LLM can propose, but no search yet.
3. **Cut visual polish.** Ship with Tailwind defaults. Branding comes in V1.1.
4. **Add error handling for File System API on Day 5.** Permission denied, folder deleted, etc.
5. **Set up a weekly file-count tracker.** Measure success objectively.

---

## 11. CLOSING

**This is a well-thought-out design.** You're not trying to boil the ocean. The architecture is sound, the technology choices are sensible, and the scope is tightly bounded.

**Your biggest risk isn't the design—it's the timeline.** 5 days is aggressive for a system with this many moving parts (LLM + file I/O + browser APIs + integration). You have a 1-day buffer. If two things go wrong, you ship with known issues or cut scope.

**My suggestion**: Start today. Do the MCP skeleton by EOD. That's your leading indicator. If it works, you're on track. If it breaks, you'll know what to redesign before investing in the website.

**You've built products before.** You know the pattern: the first integration test often reveals a gap. Build that test on Day 1, not Day 5.

---

**Questions for you before you start:**

1. Where does the MCP server run? (Local? Cloud?)
2. Have you tested multiturn conversation state in an MCP flow before?
3. What's your fallback if File System Access API breaks on a supported browser?
4. By what metric will you know the tool is working in 2 weeks?

---

**Good luck. This is launchable. Now go build it.** 🚀
