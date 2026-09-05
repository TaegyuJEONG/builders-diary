# Builder's Diary

Record what you actually **judged** in a work session — a local, judgment-first portfolio for AI-native builders.

In 2026, AI-generated output is cheap and proves little. What a recruiter can't get anywhere else — and what an AI can't fake — is the moment a human **rejected or changed** what the AI proposed, and why. Builder's Diary captures that from the traces already in your session.

Works for **any builder**, not just coders: user research, design, sales, engineering. Every record is stored locally on your machine; nothing leaves it unless you explicitly share.

## Install

```bash
npx builders-diary install --tools claude
```

Supported tools: `claude`, `cursor`, `windsurf`, `codex` (comma-separate several).

```bash
npx builders-diary install --tools claude,cursor
npx builders-diary install --tools claude --dry-run   # preview, write nothing
npx builders-diary list                               # show supported tools
```

This copies a skill into the tool's skills directory. No MCP server, no config editing.

## Use

At the end of any work session in your AI tool, type:

```
@builders-diary
```

The skill extracts the distinct work items, confirms with you, then saves each as a local record under `~/builders-diary/` with the exact structure a portfolio viewer reads:

```
~/builders-diary/{project}/{goal}/{YYYYMMDD-NN-title}/record.json
```

Each record captures a **category** (Planning / Design / Engineering / Research / Growth), the **judgment call** you made over the AI's output, and **evidence** pulled from the session (inputs, quotes, artifacts).

Add `--dry-run` to preview what would be recorded without writing:

```
@builders-diary --dry-run
```

## Privacy

All records are stored locally on your machine. Only what you explicitly share is ever sent anywhere.

## License

MIT
