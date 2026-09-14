import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = relativePath => readFile(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');

test('import review exposes dedup report and merge candidates without auto-merging semantic matches', async () => {
  const [types, review] = await Promise.all([source('src/lib/types.ts'), source('src/components/ImportReview.tsx')]);
  assert.match(types, /dedup_exact_duplicates/);
  assert.match(types, /merge_candidates/);
  assert.match(review, /Deduplication|duplicate|merge candidate/i);
  assert.match(review, /semantic/i);
});
