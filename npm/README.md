# Builder's Diary

Record what you actually **judged** in a work session — a local, judgment-first portfolio for AI-native builders.

In 2026, AI-generated output is cheap and proves little. What a recruiter can't get anywhere else — and what an AI can't fake — is the moment a human **rejected or changed** what the AI proposed, and why. Builder's Diary captures that from the traces already in your session.

Works for **any builder**, not just coders: user research, design, sales, engineering. Every record is stored locally on your machine; nothing leaves it unless you explicitly share.

## Install

```bash
npx --yes builders-diary@latest install --tools claude
```

Supported tools: `claude`, `cursor`, `windsurf`, `codex`, `antigravity` (comma-separate several).

```bash
npx --yes builders-diary@latest install --tools claude,cursor
npx --yes builders-diary@latest install --tools claude --dry-run   # preview, write nothing
npx --yes builders-diary@latest list                               # show supported tools
```

This copies a skill into the tool's skills directory. No MCP server, no config editing.

## Use

At the end of any work session, begin a new message and mention the skill by name:

```
Use the builders-diary skill for this conversation.
```

This works across AI tools. Antigravity and Claude Code expose the installed skill in slash
autocomplete; select `/builders-diary` or mention `builders-diary` by name.

The skill detects the current workspace, recommends the matching or new portfolio project through
the client's structured question UI, lets you curate candidate tasks, then reviews each card before
saving a local record under `~/Documents/builders-diary/` with the exact structure the portfolio viewer reads:

```
~/Documents/builders-diary/{project}/{section}/{YYYYMMDD-NNN-title}/record.json
```

Each record captures a **section** (Think / Plan / Build / Review / Test / Ship / Reflect), the **judgment call** you made over the AI's output, and **evidence** pulled from the session (inputs, quotes, artifacts).

Ask for a dry run to walk through the complete selection and card-review flow without saving:

```
Use the builders-diary skill for this conversation.
Run a dry run first. Do not save anything yet.
```

A dry run still asks you to choose a project and section, curate the candidate task list, and review
each card. It creates no folders, records, or evidence copies.

## Privacy

All records are stored locally on your machine. Only what you explicitly share is ever sent anywhere.

## License

MIT
