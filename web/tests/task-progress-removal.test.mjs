import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve('web');
const source = file => fs.readFile(path.join(root, file), 'utf8');

test('new task and edit writers never write PM progress', async () => {
  const [fsSource, saver, detail] = await Promise.all([
    source('src/lib/fileSystem.ts'),
    fs.readFile(path.resolve('skill/scripts/save_record.py'), 'utf8'),
    source('src/components/DetailPanel.tsx'),
  ]);
  assert.doesNotMatch(saver, /["']progress["']\s*:/);
  assert.doesNotMatch(fsSource, /progress:\s*null/);
  assert.doesNotMatch(fsSource, /record\.progress/);
  assert.doesNotMatch(detail, /draft\.progress|record\.progress|Progress/);
});

test('legacy progress stays in the type/read path only and activities are prominent', async () => {
  const [types, reader, card, detail] = await Promise.all([
    source('src/lib/types.ts'),
    source('src/lib/fileSystem.ts'),
    source('src/components/ProjectSectionView.tsx'),
    source('src/components/DetailPanel.tsx'),
  ]);
  assert.match(types, /progress\?:/);
  assert.match(reader, /progress/);
  assert.doesNotMatch(types, /PROGRESS_META/);
  assert.doesNotMatch(card, /record\.progress|PROGRESS_META/);
  assert.match(card, /Activities/);
  assert.match(card, /activity-badges/);
  assert.match(card, /position:\s*'absolute'/);
  assert.match(detail, /Activities/);
});
