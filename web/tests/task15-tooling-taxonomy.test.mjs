import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const source = (name) => readFile(join(root, '..', name), 'utf8');

test('tool taxonomy exposes canonical categories and keeps legacy tools', async () => {
  const [types, fs, portfolio] = await Promise.all([
    source('src/lib/types.ts'), source('src/lib/fileSystem.ts'), source('src/lib/portfolio.ts'),
  ]);
  for (const category of ['Programming languages', 'MCP servers', 'Skills', 'Coding agents', 'AI models', 'AI frameworks', 'Apps/platforms', 'Other']) {
    assert.match(types, new RegExp(category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(types, /toolCategories/);
  assert.match(fs, /tool_categories/);
  assert.match(fs, /tools: string\[\]/);
  assert.match(portfolio, /toolCategories/);
});

test('tool UI renders category groups for filters, detail, and proposals', async () => {
  const [header, detail, card] = await Promise.all([
    source('src/components/Header.tsx'), source('src/components/DetailPanel.tsx'), source('src/components/TaskProposalCard.tsx'),
  ]);
  assert.match(header, /tool categor/i);
  assert.match(detail, /toolCategories/);
  assert.match(card, /tool_categories|toolCategories/);
});
