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

  assert.match(table, /headCell\('#'\)/);
  assert.match(table, /headCell\('Project'\)/);
  assert.match(table, /headCell\('Chat'\)/);
  assert.match(table, /headCell\('Claude Code'\)/);
  assert.match(table, /headCell\('Summary'\)/);
  assert.doesNotMatch(table, /headCell\('Sector'\)/);
  assert.doesNotMatch(table, /headCell\('Evidence'\)/);
  assert.match(table, /kind="Chat"/);
  assert.match(table, /role="dialog"/);
  assert.match(table, /detail\.kind/);
});
