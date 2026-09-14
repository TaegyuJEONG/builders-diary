import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = relativePath => readFile(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  'utf8',
);

test('task proposal reader and normalized type are present and path-scoped', async () => {
  const fileSystem = await source('src/lib/fileSystem.ts');
  assert.match(fileSystem, /export interface TaskProposal/);
  assert.match(fileSystem, /task-proposals/);
  assert.match(fileSystem, /readTaskProposals/);
  assert.match(fileSystem, /evidence_candidates/);
  assert.doesNotMatch(fileSystem, /readFile\(/);
});

test('task proposal actions use only allowlisted helper files and poll results', async () => {
  const fileSystem = await source('src/lib/fileSystem.ts');
  assert.match(fileSystem, /writeTaskApproveAction/);
  assert.match(fileSystem, /writeTaskDropAction/);
  assert.match(fileSystem, /task-approve\.json/);
  assert.match(fileSystem, /task-drop\.json/);
  assert.match(fileSystem, /waitForTaskActionResult/);
  assert.match(fileSystem, /results/);
});

test('queue and card expose the complete review workflow in English', async () => {
  const [queue, card, review, home] = await Promise.all([
    source('src/components/TaskProposalQueue.tsx'),
    source('src/components/TaskProposalCard.tsx'),
    source('src/components/ImportReview.tsx'),
    source('src/app/home-content.tsx'),
  ]);
  for (const text of [queue, card]) {
    for (const label of ['Approve', 'Edit and approve', 'Drop', 'Purpose', 'Activities', 'Tools', 'Mindset', 'Evidence']) {
      assert.match(text, new RegExp(label));
    }
  }
  assert.match(review, /TaskProposalQueue/);
  assert.match(home, /TaskProposalQueue/);
});
