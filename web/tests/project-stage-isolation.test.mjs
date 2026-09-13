import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const homeContentPath = fileURLToPath(
  new URL('../src/app/home-content.tsx', import.meta.url),
);

test('deleting a selected project stage never rewrites the portfolio stage configuration', async () => {
  const source = await readFile(homeContentPath, 'utf8');
  const start = source.indexOf('const deleteStageAfterConfirm');
  const end = source.indexOf('// Total records across the whole portfolio', start);

  assert.notEqual(start, -1, 'stage deletion handler must exist');
  assert.notEqual(end, -1, 'stage deletion handler must end before derived state');

  const handler = source.slice(start, end);
  assert.match(handler, /deleteRecordFromFile\(record\.file_path\)/);
  assert.doesNotMatch(handler, /writeStages\(/);
});
