import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const read = name => readFile(fileURLToPath(new URL(`../src/components/${name}`, import.meta.url)), 'utf8');

test('Claude export download keeps manifest links in browser memory only', async () => {
  const source = await read('ClaudeExportDownload.tsx');
  assert.match(source, /Choose the manifest JSON/);
  assert.match(source, /data_files/);
  assert.match(source, /conversations/);
  assert.match(source, /projects/);
  assert.match(source, /memories/);
  assert.match(source, /application\/json/);
  assert.match(source, /https:/);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /writeFile|createWritable/);
});

test('export download explains required archives and reports malformed manifests', async () => {
  const source = await read('ClaudeExportDownload.tsx');
  assert.match(source, /role="alert"/);
  assert.match(source, /Conversations and Projects are required/);
  assert.match(source, /Required downloads ready/);
});
