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

test('stage edits are written to the project, never to the portfolio stage template', async () => {
  const [managePanel, homeContent] = await Promise.all([
    source('src/components/ManagePanel.tsx'),
    source('src/app/home-content.tsx'),
  ]);

  for (const file of [managePanel, homeContent]) {
    assert.doesNotMatch(file, /writeStages\(/, 'only the root template file may use writeStages');
    assert.match(file, /updateProjectStagesInFolder/);
  }
});

test('the side panel is scoped to a single job instead of portfolio tabs', async () => {
  const managePanel = await source('src/components/ManagePanel.tsx');

  for (const kind of ['create-project', 'edit-project', 'stages', 'new-task']) {
    assert.match(managePanel, new RegExp(`kind: '${kind}'`), `missing ${kind} mode`);
  }
  assert.doesNotMatch(managePanel, /createOnly/, 'no portfolio-wide create/edit switch');
  assert.doesNotMatch(managePanel, /Manage portfolio/, 'no portfolio-wide management surface');
});

test('deleting a stage still confirms through an in-app dialog that lists its tasks', async () => {
  const managePanel = await source('src/components/ManagePanel.tsx');

  assert.match(managePanel, /ConfirmDialog/);
  assert.match(managePanel, /stageRemoval/);
  assert.match(managePanel, /deleteRecordFromFile\(task\.file_path\)/);
  assert.doesNotMatch(managePanel, /window\.confirm/, 'product actions use the themed dialog');
});

test('every stage deletion resolves Tasks the same way the board does', async () => {
  const [homeContent, managePanel, projectView] = await Promise.all([
    source('src/app/home-content.tsx'),
    source('src/components/ManagePanel.tsx'),
    source('src/components/ProjectSectionView.tsx'),
  ]);

  for (const file of [homeContent, managePanel, projectView]) {
    assert.match(file, /resolveRecordStage/, 'stage membership must come from one resolver');
  }
});

test('project board and filters use the active project stage list', async () => {
  const [homeContent, projectView, header] = await Promise.all([
    source('src/app/home-content.tsx'),
    source('src/components/ProjectSectionView.tsx'),
    source('src/components/Header.tsx'),
  ]);

  assert.match(projectView, /active\?\.stages/);
  assert.match(header, /selectedProject\?\.stages/);
  assert.match(homeContent, /selectedRecordProjectStages/);
});
