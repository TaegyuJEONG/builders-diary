#!/usr/bin/env node
'use strict';

/**
 * builders-diary CLI — installs the Builder's Diary skill into each AI tool's
 * skills directory. No MCP, no config editing: a skill is just files in a folder.
 *
 * Usage:
 *   cd ~ && npx --yes --package=builders-diary@latest builders-diary install --tools claude,cursor,antigravity
 *   cd ~ && npx --yes --package=builders-diary@latest builders-diary install --tools claude --dry-run
 *   cd ~ && npx --yes --package=builders-diary@latest builders-diary list
 *
 * Zero runtime dependencies (only Node core) so npx is fast and can't fail on installs.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// tool id → skills directory (parent that will contain builders-diary/)
const TOOL_DIRS = {
  claude:   '~/.claude/skills',
  cursor:   '~/.cursor/skills',
  windsurf: '~/.codeium/windsurf/skills',
  codex:    '~/.codex/skills',
  // Google Antigravity IDE global skills. Workspace-specific installation is
  // intentionally not used here: onboarding must not require a project path.
  antigravity: '~/.gemini/config/skills',
};

const SKILL_NAME = 'builders-diary';
const PAYLOAD = ['SKILL.md', 'scripts']; // relative to the packaged skill/ dir

function resolveHome(p) {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

// The packaged skill payload lives at ../skill relative to this bin/ file.
function skillSourceDir() {
  return path.join(__dirname, '..', 'skill');
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function parseArgs(argv) {
  const args = { _: [], tools: 'claude', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--tools') args.tools = argv[++i] || '';
    else if (a.startsWith('--tools=')) args.tools = a.slice('--tools='.length);
    else if (a === '-h' || a === '--help') args.help = true;
    else args._.push(a);
  }
  return args;
}

function printHelp() {
  console.log(`builders-diary — record what you actually judged in a work session.

Usage:
  cd ~ && npx --yes --package=builders-diary@latest builders-diary install --tools claude,cursor,antigravity   Install the skill
  cd ~ && npx --yes --package=builders-diary@latest builders-diary install --tools claude --dry-run  Preview, write nothing
  cd ~ && npx --yes --package=builders-diary@latest builders-diary list                            Show supported tools

Supported tools: ${Object.keys(TOOL_DIRS).join(', ')}
After installing, restart your AI tool, begin a new conversation, and mention builders-diary by name.`);
}

function cmdList() {
  console.log('Supported tools:');
  for (const [tool, dir] of Object.entries(TOOL_DIRS)) {
    const configRoot = path.dirname(resolveHome(dir));
    const mark = fs.existsSync(configRoot) ? '\u2713' : ' ';
    console.log(`  [${mark}] ${tool.padEnd(9)} \u2192 ${dir}/${SKILL_NAME}/`);
  }
  console.log('\n  \u2713 = the tool\'s config dir exists (tool likely installed)');
}

function cmdInstall(args) {
  const src = skillSourceDir();
  const missing = PAYLOAD.filter(p => !fs.existsSync(path.join(src, p)));
  if (missing.length) {
    console.error(`ERROR: packaged skill is incomplete, missing: ${missing.join(', ')}`);
    process.exit(1);
  }

  const tools = args.tools.split(',').map(t => t.trim()).filter(Boolean);
  const unknown = tools.filter(t => !TOOL_DIRS[t]);
  if (unknown.length) {
    console.error(`ERROR: unknown tool(s): ${unknown.join(', ')}`);
    console.error(`Supported: ${Object.keys(TOOL_DIRS).join(', ')}`);
    process.exit(1);
  }

  console.log(`Builder's Diary skill — ${args.dryRun ? 'DRY RUN (nothing written)' : 'installing'}\n`);

  for (const tool of tools) {
    const dest = path.join(resolveHome(TOOL_DIRS[tool]), SKILL_NAME);
    console.log(`[${tool}]`);
    for (const item of PAYLOAD) {
      const shownDest = path.join(dest, item).replace(os.homedir(), '~');
      if (args.dryRun) {
        console.log(`  would copy ${item} \u2192 ${shownDest}`);
      } else {
        const s = path.join(src, item);
        const d = path.join(dest, item);
        if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
        copyRecursive(s, d);
        console.log(`  copied ${item} \u2192 ${shownDest}`);
      }
    }
    // keep the save script executable
    if (!args.dryRun) {
      const script = path.join(dest, 'scripts', 'save_record.py');
      if (fs.existsSync(script)) fs.chmodSync(script, 0o755);
    }
    console.log('');
  }

  if (args.dryRun) {
    console.log('Re-run without --dry-run to install.');
    return;
  }

  // Create the data folder the skill saves to, and drop an install marker
  // so the web app can verify the install when the user connects the folder.
  // Root rule (shared with the skill + web): ~/Documents/builders-diary when
  // ~/Documents exists, else ~/builders-diary. Documents is used because the
  // browser folder picker can open directly inside it (startIn: 'documents').
  const docs = path.join(os.homedir(), 'Documents');
  const dataRoot = path.join(fs.existsSync(docs) ? docs : os.homedir(), SKILL_NAME);
  fs.mkdirSync(dataRoot, { recursive: true });

  const markerPath = path.join(dataRoot, '.builders-diary.json');
  let marker = {};
  try { marker = JSON.parse(fs.readFileSync(markerPath, 'utf8')); } catch { /* first install */ }
  const mergedTools = Array.from(new Set([...(marker.tools || []), ...tools]));
  let version = '0.0.0';
  try { version = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version; } catch { /* ignore */ }
  fs.writeFileSync(markerPath, JSON.stringify({
    version,
    tools: mergedTools,
    root: dataRoot,
    installed_at: new Date().toISOString(),
  }, null, 2) + '\n');

  const shownRoot = dataRoot.replace(os.homedir(), '~');
  console.log(`\u2713 Data folder ready \u2192 ${shownRoot}`);
  console.log('\nDone. Go back to the web page and pick that folder.');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];

  if (args.help || !cmd) { printHelp(); return; }
  if (cmd === 'list') { cmdList(); return; }
  if (cmd === 'install') { cmdInstall(args); return; }

  console.error(`Unknown command: ${cmd}`);
  printHelp();
  process.exit(1);
}

main();
