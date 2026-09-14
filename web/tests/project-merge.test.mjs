import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = relativePath => readFile(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');

test('project cards expose an explicit merge action with target and source selection', async () => {
  const [view, detail] = await Promise.all([
    source('src/components/ProjectSectionView.tsx'),
    source('src/components/ProjectDetailPanel.tsx'),
  ]);
  assert.match(view, /Merge projects/);
  assert.match(detail, /targetSlug/);
  assert.match(detail, /sourceSlug/);
  assert.match(detail, /Confirm merge/);
});

test('web merge writes declarative action and waits for helper result', async () => {
  const [fs, home] = await Promise.all([source('src/lib/fileSystem.ts'), source('src/app/home-content.tsx')]);
  assert.match(fs, /project-merge\.json/);
  assert.match(fs, /project\.merge/);
  assert.match(fs, /results/);
  assert.match(home, /wait.*merge|merge.*result/i);
  assert.doesNotMatch(home, /removeEntry\([^)]*source/);
});
