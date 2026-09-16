import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = async relativePath => readFile(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  'utf8',
);

test('onboarding derives its connected-folder state from the folder handle and install marker', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');
  const fileSystem = await source('src/lib/fileSystem.ts');

  assert.match(fileSystem, /readInstallMarker/);
  assert.match(onboarding, /markerStatus === 'ok'/);
  assert.match(onboarding, /title="Import your portfolio"/);
});

test('a connected valid installation keeps the route choice visible until explicit completion', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');
  const home = await source('src/app/home-content.tsx');

  assert.match(onboarding, /type CaptureRoute = 'choose' \| 'bulk' \| 'individual'/);
  assert.match(home, /installMarker/);
  assert.match(home, /A connected folder alone does not complete onboarding/);
  assert.match(home, /setOnboardingDone\(\(data\.projects \|\| \[\]\)\.length > 0\)/);
});

test('an arbitrary connected folder without a marker offers another folder choice, not an error', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.doesNotMatch(onboarding, /wasn&apos;t set up by the installer/);
  assert.match(onboarding, /Choose another folder/);
});

test('a fresh onboarding does not restore a previous source choice', async () => {
  const home = await source('src/app/home-content.tsx');

  assert.match(home, /const wasDone = typeof window !== 'undefined'/);
  assert.match(home, /if \(wasDone\) \{[\s\S]*?const savedTools = localStorage\.getItem\(TOOLS_KEY\)/);
  assert.doesNotMatch(home, /\/\/ Always restore selected tools/);
});

test('install command copy is next to the command and lower hierarchy than continue', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.match(onboarding, /commandBox/);
  assert.match(onboarding, /aria-label="Copy command"/);
  assert.match(onboarding, /title="Copy command"/);
  assert.match(onboarding, /Installed — continue/);
});

test('route choices are neutral until the user explicitly clicks one', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.match(onboarding, /routeButton\(false\)/);
  assert.match(onboarding, />\s*Single import\s*</);
  assert.doesNotMatch(onboarding, /Open the current Claude Code chat and use the import skill/);
  assert.doesNotMatch(onboarding, /claude:\/\//);
  assert.doesNotMatch(onboarding, /Enter portfolio/);
});

test('onboarding exposes copy install command, connected path, and stacked route descriptions', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');
  assert.match(onboarding, /Copy/);
  assert.match(onboarding, /folderPath/);
  assert.match(onboarding, /Connected folder/);
  assert.match(onboarding, /display: 'block'/);
  assert.doesNotMatch(onboarding, /It checks the selected apps/);
  assert.doesNotMatch(onboarding, /Open the current Claude Code chat/);
  assert.match(onboarding, /regular skill/);
});
