import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = relativePath => readFile(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');

test('project detail offers a constrained local logo picker and URL fallback', async () => {
  const detail = await source('src/components/ProjectDetailPanel.tsx');
  assert.match(detail, /type="file"/);
  assert.match(detail, /image\/png,image\/jpeg,image\/webp/);
  assert.match(detail, /5 MB|5 \* 1024 \* 1024/);
  assert.match(detail, /URL/);
});

test('local logo upload writes an allowlisted action and polls its helper result', async () => {
  const [fs, detail, protocol, helper] = await Promise.all([
    source('src/lib/fileSystem.ts'),
    source('src/components/ProjectDetailPanel.tsx'),
    source('../skill/scripts/action_protocol.py'),
    source('../skill/scripts/project_actions.py'),
  ]);
  assert.match(fs, /writeProjectLogoAction[\s\S]*waitForProjectLogoResult/);
  assert.match(detail, /writeProjectLogoAction[\s\S]*waitForProjectLogoResult/);
  assert.match(protocol, /project\.logo/);
  assert.match(helper, /validate_logo_bytes[\s\S]*write_json_atomic/);
});

test('project logo metadata remains a relative path', async () => {
  const [fs, helper] = await Promise.all([source('src/lib/fileSystem.ts'), source('../skill/scripts/project_actions.py')]);
  assert.match(helper, /assets\/logo\./);
  assert.match(helper, /relative_logo|relative path/i);
});
