import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = relativePath => readFile(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');

test('project cards expose no merge UI in v1 while the declarative merge contract stays', async () => {
  const [view, detail] = await Promise.all([
    source('src/components/ProjectSectionView.tsx'),
    source('src/components/ProjectDetailPanel.tsx'),
  ]);
  assert.doesNotMatch(view, /Merge projects/);
  assert.doesNotMatch(view, /Split project/);
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

test('project detail split stays available only via the detail contract, not card buttons', async () => {
  const [view, detail] = await Promise.all([
    source('src/components/ProjectSectionView.tsx'),
    source('src/components/ProjectDetailPanel.tsx'),
  ]);
  assert.doesNotMatch(view, /Split project/);
  assert.match(detail, /Split project/);
  assert.match(detail, /selectedTaskIds/);
  assert.match(detail, /Confirm split/);
});

test('web split writes declarative action and polls its result without filesystem mutation', async () => {
  const [fs, home] = await Promise.all([source('src/lib/fileSystem.ts'), source('src/app/home-content.tsx')]);
  assert.match(fs, /project-split\.json/);
  assert.match(fs, /project\.split/);
  assert.match(fs, /waitForProjectSplitResult/);
  assert.match(home, /wait.*split|split.*result/i);
  assert.doesNotMatch(home, /removeEntry\([^)]*split/);
});
