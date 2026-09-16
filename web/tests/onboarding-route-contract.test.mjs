import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = relativePath => readFile(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  'utf8',
);

test('a fresh browser requires a source choice before it shows installer guidance', async () => {
  const [onboarding, npmPackage] = await Promise.all([
    source('src/components/OnboardingScreen.tsx'),
    source('../npm/package.json'),
  ]);
  const { version } = JSON.parse(npmPackage);

  assert.equal(typeof version, 'string');
  assert.match(onboarding, /Where should we bring in past work from\?/);
  assert.match(onboarding, /Claude/);
  assert.match(onboarding, /Cursor/);
  assert.match(onboarding, /Codex CLI/);
  assert.match(onboarding, /Hermes/);
  assert.doesNotMatch(onboarding, /ChatGPT|Gemini|Grok|Antigravity/);
  assert.ok(onboarding.includes("import installerPackage from '../../../npm/package.json';"));
  assert.match(onboarding, /function installCommand\(sources: SourceId\[\]\)/);
  assert.match(onboarding, /tools\.push\('cursor'\)/);
  assert.match(onboarding, /tools\.push\('codex'\)/);
  assert.match(onboarding, /selectedSources\.length > 0 && <StepCard n=\{2\}/);
  assert.match(onboarding, /review runs in Claude Code/);
  assert.match(onboarding, />\s*Installed — continue\s*</);
  assert.ok(onboarding.includes("(selectedSources.length > 0 && installAcknowledged && markerStatus !== 'ok') && <StepCard n={3}"));
  assert.ok(onboarding.includes("done={installAcknowledged || markerStatus === 'ok'}"));
  assert.ok(onboarding.includes("markerStatus === 'ok' || installAcknowledged ?"));
  assert.doesNotMatch(onboarding, /Works with/);
  assert.doesNotMatch(onboarding, /Install the skill/);
  assert.doesNotMatch(onboarding, /adapter|absolute source root|client history connections|enabled|coming soon/i);
});

test('the first add-work screen exposes exactly the two route choices', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.match(onboarding, />\s*Bulk import\s*</);
  assert.match(onboarding, /Build your portfolio from your past conversations\./);
  assert.match(onboarding, />\s*Single import\s*</);
  assert.match(onboarding, /Start with one conversation and create your first portfolio entry\./);
  assert.match(onboarding, /type CaptureRoute = 'choose' \| 'bulk' \| 'individual'/);
});

test('bulk route directs every selected source to Claude Code without web export or path pickers', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.match(onboarding, /Open a new Claude Code chat and use the import skill\./);
  assert.doesNotMatch(onboarding, /Open the current Claude Code chat/);
  assert.match(onboarding, /aria-label="Copy import skill"/);
  assert.match(onboarding, /title="Copy import skill"/);
  assert.match(onboarding, /Portfolio folder:/);
  assert.match(onboarding, /connected-folder-name/);
  assert.match(onboarding, /Claude Sonnet 5 \/ Medium/);
  assert.match(onboarding, /5-hour limit remaining/);

  assert.match(onboarding, /Cursor/);
  assert.match(onboarding, /Codex CLI/);
  assert.match(onboarding, /Hermes/);
  assert.doesNotMatch(onboarding, /ClaudeExportDownload/);
  assert.doesNotMatch(onboarding, /ClientRootsSettings/);
  assert.doesNotMatch(onboarding, /manifest|download links|Local history folder/i);
});

test('individual route uses the regular skill, not export or import flow', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.match(onboarding, /Open the Claude chat, Cowork space, or Claude Code session you want to turn into a portfolio entry, then use the regular skill\./);
  assert.match(onboarding, /aria-label="Copy regular skill"/);
  assert.match(onboarding, /title="Copy regular skill"/);
  assert.match(onboarding, /Portfolio folder:/);
  assert.match(onboarding, /connected-folder-name/);
  assert.match(onboarding, /Claude Sonnet 5 \/ Medium/);
  assert.match(onboarding, /5-hour limit remaining/);
  assert.match(onboarding, /captureRoute === 'individual'/);
});

test('onboarding cannot enter the portfolio before an import proposal is confirmed', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.doesNotMatch(onboarding, /Enter portfolio/);
  assert.match(onboarding, /<ImportSelectionTable onSaved={onComplete}/);
});

test('onboarding has no manual local-history folder input', async () => {
  const settings = await source('src/components/ClientRootsSettings.tsx');

  assert.doesNotMatch(settings, /Local history folder|Paste the folder path|selectFolder|writeImportConfig/);
});
