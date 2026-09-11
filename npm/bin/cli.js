#!/usr/bin/env node
'use strict';

/**
 * builders-diary CLI — installs the Builder's Diary skill into each AI tool's
 * skills directory. No MCP, no config editing: a skill is just files in a folder.
 *
 * Usage:
 *   npx --yes builders-diary@latest install --tools claude,cursor,antigravity
 *   npx --yes builders-diary@latest install --tools claude --dry-run
 *   npx --yes builders-diary@latest list
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
const SCRIPT_TOKEN = '{{BUILDERS_DIARY_SCRIPT}}';
const IMPORT_SKILL_NAME = 'builders-diary-import';
const IMPORT_PAYLOAD = ['SKILL.md'];
const IMPORT_SCRIPT_TOKEN = '{{BUILDERS_DIARY_IMPORT_SCRIPT}}';

function resolveHome(p) {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

// The packaged skill payload lives at ../skill relative to this bin/ file.
function skillSourceDir() {
  return path.join(__dirname, '..', 'skill');
}

function importSkillSourceDir() {
  return path.join(__dirname, '..', 'import-skill');
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
  npx --yes builders-diary@latest install --tools claude,cursor,antigravity   Install the skill
  npx --yes builders-diary@latest install --tools claude --dry-run  Preview, write nothing
  npx --yes builders-diary@latest list                            Show supported tools

Supported tools: ${Object.keys(TOOL_DIRS).join(', ')}
After installing, restart your AI tool. In Antigravity or Claude Code, select /builders-diary from slash autocomplete; on other clients, mention builders-diary by name.`);
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
  const importSrc = importSkillSourceDir();
  const missing = PAYLOAD.filter(p => !fs.existsSync(path.join(src, p)));
  const importMissing = [
    ...IMPORT_PAYLOAD.filter(p => !fs.existsSync(path.join(importSrc, p))),
    ...(fs.existsSync(path.join(src, 'scripts', 'claude_import.py')) ? [] : ['skill/scripts/claude_import.py']),
  ];
  if (missing.length || importMissing.length) {
    console.error(`ERROR: packaged skills are incomplete, missing: ${[...missing, ...importMissing].join(', ')}`);
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
    // Bind this installed SKILL.md to its own helper so another client's
    // older installation can never shadow it.
    if (!args.dryRun) {
      const script = path.join(dest, 'scripts', 'save_record.py');
      const skillFile = path.join(dest, 'SKILL.md');
      const skillText = fs.readFileSync(skillFile, 'utf8');
      if (!skillText.includes(SCRIPT_TOKEN)) {
        throw new Error(`Packaged SKILL.md is missing ${SCRIPT_TOKEN}`);
      }
      fs.writeFileSync(skillFile, skillText.split(SCRIPT_TOKEN).join(script));
      if (fs.existsSync(script)) fs.chmodSync(script, 0o755);
      console.log(`  bound helper → ${script.replace(os.homedir(), '~')}`);
    }

    if (tool === 'claude') {
      const importDest = path.join(resolveHome(TOOL_DIRS[tool]), IMPORT_SKILL_NAME);
      console.log(`  [${IMPORT_SKILL_NAME}]`);
      for (const item of IMPORT_PAYLOAD) {
        const shownDest = path.join(importDest, item).replace(os.homedir(), '~');
        if (args.dryRun) {
          console.log(`    would copy ${item} → ${shownDest}`);
        } else {
          const sourceItem = path.join(importSrc, item);
          const destItem = path.join(importDest, item);
          if (fs.existsSync(destItem)) fs.rmSync(destItem, { recursive: true, force: true });
          copyRecursive(sourceItem, destItem);
          console.log(`    copied ${item} → ${shownDest}`);
        }
      }
      const importScript = path.join(importDest, 'scripts', 'claude_import.py');
      if (args.dryRun) {
        console.log(`    would copy claude_import.py → ${importScript.replace(os.homedir(), '~')}`);
      } else {
        copyRecursive(path.join(src, 'scripts', 'claude_import.py'), importScript);
        const importSkillFile = path.join(importDest, 'SKILL.md');
        const importSkillText = fs.readFileSync(importSkillFile, 'utf8');
        if (!importSkillText.includes(IMPORT_SCRIPT_TOKEN)) {
          throw new Error(`Packaged import SKILL.md is missing ${IMPORT_SCRIPT_TOKEN}`);
        }
        fs.writeFileSync(importSkillFile, importSkillText.split(IMPORT_SCRIPT_TOKEN).join(importScript));
        fs.chmodSync(importScript, 0o755);
        console.log(`    bound helper → ${importScript.replace(os.homedir(), '~')}`);
      }
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
