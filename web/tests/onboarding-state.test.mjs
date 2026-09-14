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

test('step three first asks bulk import versus individual capture without a deep link', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.match(onboarding, />\s*Bulk import\s*</);
  assert.match(onboarding, />\s*Add one conversation\s*</);
  assert.match(onboarding, /Open a new Claude Code or Desktop Code chat/);
  assert.doesNotMatch(onboarding, /claude:\/\//);
  assert.doesNotMatch(onboarding, /Enter portfolio/);
});
