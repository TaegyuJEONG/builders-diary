import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = async relativePath => readFile(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  'utf8',
);

test('projects own their stage list in the data model and filesystem scan', async () => {
  const [types, fileSystem] = await Promise.all([
    source('src/lib/types.ts'),
    source('src/lib/fileSystem.ts'),
  ]);

  assert.match(types, /interface Project[\s\S]*?stages\?: string\[\]/);
  assert.match(fileSystem, /const projectStages = .*meta\.stages/);
  assert.match(fileSystem, /stages: projectStages/);
  assert.match(fileSystem, /updateProjectStagesInFolder/);
});

test('Manage portfolio edits the selected project stages instead of root stages.json', async () => {
  const managePanel = await source('src/components/ManagePanel.tsx');

  assert.match(managePanel, /updateProjectStagesInFolder/);
  assert.doesNotMatch(managePanel, /writeStages\(/);
  assert.match(managePanel, /selected\.stages/);
});

test('project board and filters use the active project stage list', async () => {
  const [homeContent, projectView, header] = await Promise.all([
    source('src/app/home-content.tsx'),
    source('src/components/ProjectSectionView.tsx'),
    source('src/components/Header.tsx'),
  ]);

  assert.match(projectView, /active\?\.stages/);
  assert.match(header, /selectedProject\?\.stages/);
  assert.match(homeContent, /updateProjectStagesInFolder/);
  assert.match(homeContent, /project_slug === targetProjectSlug/);
});
