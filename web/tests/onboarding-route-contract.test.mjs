import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = relativePath => readFile(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  'utf8',
);

test('onboarding starts with a folder step rather than an internal tool chooser', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.match(onboarding, /title="Import your portfolio"/);
  assert.doesNotMatch(onboarding, /Works with/);
  assert.doesNotMatch(onboarding, /phase === 'choose'/);
  assert.doesNotMatch(onboarding, /Install the skill/);
  assert.doesNotMatch(onboarding, /npx --yes builders-diary/);
});

test('the first add-work screen exposes exactly the two route choices', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.match(onboarding, />\s*Bulk import\s*</);
  assert.match(onboarding, />\s*Add one conversation\s*</);
  assert.match(onboarding, /type CaptureRoute = 'choose' \| 'bulk' \| 'individual'/);
});

test('bulk route lists every supported local-history tool and keeps Claude export guidance there', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.match(onboarding, /Chat exports/);
  assert.match(onboarding, /Claude Settings &gt; Privacy/);
  assert.match(onboarding, /Copy \/builders-diary-import/);
  assert.match(onboarding, /From a folder/);
  assert.match(onboarding, /Cursor/);
  assert.match(onboarding, /Codex CLI/);
  assert.match(onboarding, /Hermes/);
  assert.match(onboarding, /<ClaudeExportDownload \/>/);
  assert.doesNotMatch(onboarding, /ChatGPT/);
});

test('individual route uses the regular skill, not export or import flow', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.match(onboarding, /Open a new Claude Code or Desktop Code chat/);
  assert.match(onboarding, /Copy \/builders-diary/);
  assert.match(onboarding, /captureRoute === 'individual'/);
});

test('onboarding cannot enter the portfolio before an import proposal is confirmed', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.doesNotMatch(onboarding, /Enter portfolio/);
  assert.match(onboarding, /<ImportSelectionTable onSaved={onComplete}/);
});

test('the folder picker surface uses natural language and preserves explicit opt-in safety', async () => {
  const settings = await source('src/components/ClientRootsSettings.tsx');

  assert.doesNotMatch(settings, /Client history connections/);
  assert.doesNotMatch(settings, /Absolute source root/);
  assert.doesNotMatch(settings, />Adapter</);
  assert.doesNotMatch(settings, /coming soon/i);
  assert.match(settings, /Choose the folder containing its local history/);
  assert.match(settings, /selectFolder/);
  assert.match(settings, /writeImportConfig/);
});
