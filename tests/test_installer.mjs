import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CLI = path.resolve('npm/bin/cli.js');

function runCli(args, env = {}) {
  return spawnSync('node', [CLI, ...args], {
    encoding: 'utf8',
    cwd: path.resolve('.'),
    env: { ...process.env, ...env },
  });
}

test('install writes the marker into a custom absolute data root', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'bd-installer-'));
  try {
    const root = path.join(base, 'any-portfolio');
    const result = runCli(['install', '--tools', 'claude', '--data-root', root, '--dry-run']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('custom data root without --dry-run creates the folder and marker without touching user files', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'bd-installer-'));
  try {
    const root = path.join(base, 'existing');
    mkdirSync(root, { recursive: true });
    const keep = path.join(root, 'keep.txt');
    writeFileSync(keep, 'user data', 'utf8');
    const result = runCli(['install', '--tools', 'claude', '--data-root', root]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(keep, 'utf8'), 'user data');
    const marker = JSON.parse(readFileSync(path.join(root, '.builders-diary.json'), 'utf8'));
    assert.equal(marker.root, root);
    assert.ok(marker.tools.includes('claude'));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('a tilde data root is expanded to the home directory', () => {
  const target = '~/.builders-diary-plan-test-' + process.pid;
  const expanded = target.replace('~', process.env.HOME || tmpdir());
  try {
    const result = runCli(['install', '--tools', 'claude', '--data-root', target]);
    assert.equal(result.status, 0, result.stderr);
    const marker = JSON.parse(readFileSync(path.join(expanded, '.builders-diary.json'), 'utf8'));
    assert.equal(marker.root, expanded);
  } finally {
    rmSync(expanded, { recursive: true, force: true });
  }
});

test('a relative data root is rejected without writing anything', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'bd-installer-'));
  try {
    const relative = path.relative('.', path.join(base, 'rel')) || path.join(base, 'rel');
    const result = runCli(['install', '--tools', 'claude', '--data-root', relative]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /absolute/);
    assert.equal(existsSync(path.join('.', '.builders-diary.json')), false);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('an existing regular file as data root fails without modifying it', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'bd-installer-'));
  try {
    const file = path.join(base, 'not-a-folder');
    writeFileSync(file, 'precious', 'utf8');
    const result = runCli(['install', '--tools', 'claude', '--data-root', file]);
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(file, 'utf8'), 'precious');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
