import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = relativePath => readFile(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');

test('project enrichment is an allowlisted proposal with a pending card state', async () => {
  const [protocol, fs, detail, queue] = await Promise.all([
    source('../skill/scripts/action_protocol.py'),
    source('src/lib/fileSystem.ts'),
    source('src/components/ProjectDetailPanel.tsx'),
    source('src/components/ProjectEnrichmentQueue.tsx'),
  ]);
  assert.match(protocol, /project\.enrich/);
  assert.match(fs, /project-enrich\.json/);
  assert.match(fs, /project\.enrich/);
  assert.match(detail, /Pending enrichment|Enrich project|Sector|One-line story/);
  assert.match(queue, /Pending enrichment|Approve enrichment/);
});

test('approval polls result before refreshing the project card', async () => {
  const [fs, queue] = await Promise.all([source('src/lib/fileSystem.ts'), source('src/components/ProjectEnrichmentQueue.tsx')]);
  assert.match(fs, /waitForProjectEnrichResult/);
  assert.match(queue, /writeProjectEnrichAction[\s\S]*waitForProjectEnrichResult[\s\S]*onSaved/);
});

test('initial project selection does not request sector or one-line metadata', async () => {
  const [table, fs] = await Promise.all([source('src/components/ImportSelectionTable.tsx'), source('src/lib/fileSystem.ts')]);
  assert.doesNotMatch(table, /Sector|One-line story|one_liner/);
  assert.doesNotMatch(fs, /sector:.*one_liner.*project-confirm|project-confirm.*sector/);
});
