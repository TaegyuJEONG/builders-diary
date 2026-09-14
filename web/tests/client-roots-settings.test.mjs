import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = relativePath => readFile(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  'utf8',
);

test('browser onboarding has no local-history path control or home scan', async () => {
  const [settings, fileSystem] = await Promise.all([
    source('src/components/ClientRootsSettings.tsx'),
    source('src/lib/fileSystem.ts'),
  ]);

  assert.match(settings, /known local location in Claude Code/);
  assert.doesNotMatch(settings, /input|folder path|selectFolder|writeImportConfig/i);
  assert.doesNotMatch(settings, /scanHome|readdir\(.*home|recursive.*home/i);
  assert.match(fileSystem, /readImportConfig/);
  assert.match(fileSystem, /writeImportConfig/);
});

test('install marker carries import client and explicit source-root metadata', async () => {
  const cli = await source('../npm/bin/cli.js');
  assert.match(cli, /enabled_clients/);
  assert.match(cli, /source_roots/);
  assert.match(cli, /adapter_ids/);
});
