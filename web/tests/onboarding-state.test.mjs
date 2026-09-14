import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = async relativePath => readFile(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  'utf8',
);

test('onboarding derives its step from the folder handle and install marker', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');
  const fileSystem = await source('src/lib/fileSystem.ts');

  assert.match(fileSystem, /readInstallMarker/);
  assert.match(onboarding, /markerStatus === 'ok'/);
  assert.match(onboarding, /CaptureMode|captureMode|Choose how to add work/);
});

test('a connected valid installation keeps the capture choice visible until explicit completion', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');
  const home = await source('src/app/home-content.tsx');

  assert.match(onboarding, /phase === 'choose'/);
  assert.match(home, /installMarker/);
  assert.match(home, /A connected folder alone does not complete onboarding/);
  assert.match(home, /setOnboardingDone\(\(data\.projects \|\| \[\]\)\.length > 0\)/);
});

test('an arbitrary connected folder without a marker offers initialization, not an error', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.doesNotMatch(onboarding, /wasn&apos;t set up by the installer/);
  assert.match(onboarding, /initialize|Initialize/);
});

test('step three asks bulk import versus individual capture and never deep-links Claude', async () => {
  const onboarding = await source('src/components/OnboardingScreen.tsx');

  assert.match(onboarding, /Import past work in bulk/);
  assert.match(onboarding, /Add work from one conversation/);
  assert.match(onboarding, /Start a new chat in Claude Code/);
  assert.match(onboarding, /conversation you want to turn into portfolio work/);
  assert.doesNotMatch(onboarding, /claude:\/\//);
  assert.doesNotMatch(onboarding, /Open Claude Code/);
});
