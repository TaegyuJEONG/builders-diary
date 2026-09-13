import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = relativePath => readFile(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  'utf8',
);

test('import selection reads the agent proposal, never the raw discovery list', async () => {
  const [fileSystem, table] = await Promise.all([
    source('src/lib/fileSystem.ts'),
    source('src/components/ImportSelectionTable.tsx'),
  ]);

  assert.match(fileSystem, /readProjectProposal/);
  assert.match(fileSystem, /project-proposal\.json/);
  assert.match(table, /readProjectProposal/);
  assert.doesNotMatch(table, /readProjectCandidates/);
  assert.match(table, /Waiting for Claude Code to propose projects/);
});

test('proposal table uses human source labels instead of ids or card metadata', async () => {
  const table = await source('src/components/ImportSelectionTable.tsx');

  assert.match(table, /head\('#'\)/);
  assert.match(table, /head\('Project'\)/);
  assert.match(table, /head\('Chat'\)/);
  assert.match(table, /head\('Claude Code'\)/);
  assert.match(table, /head\('Summary'\)/);
  assert.doesNotMatch(table, /Sector/);
  assert.doesNotMatch(table, /Evidence/);
  assert.match(table, /Chat metadata from Claude export/);
});
