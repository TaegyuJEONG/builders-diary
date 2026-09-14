import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = relativePath => readFile(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  'utf8',
);

test('folder import connection requires an explicit user choice and never scans home directories', async () => {
  const [settings, fileSystem] = await Promise.all([
    source('src/components/ClientRootsSettings.tsx'),
    source('src/lib/fileSystem.ts'),
  ]);

  assert.match(settings, /Choose the folder containing its local history/);
  assert.match(settings, /Choose this folder/);
  assert.match(settings, /Cursor/);
  assert.match(settings, /Codex CLI/);
  assert.match(settings, /Hermes/);
  assert.doesNotMatch(settings, /scanHome|readdir\(.*home|recursive.*home/i);
  assert.match(settings, /selectFolder/);
  assert.match(fileSystem, /readImportConfig/);
  assert.match(fileSystem, /writeImportConfig/);
});

test('install marker carries import client and explicit source-root metadata', async () => {
  const cli = await source('../npm/bin/cli.js');
  assert.match(cli, /enabled_clients/);
  assert.match(cli, /source_roots/);
  assert.match(cli, /adapter_ids/);
});
