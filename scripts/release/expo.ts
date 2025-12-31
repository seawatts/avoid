import { $ } from 'bun';
import type { PackageInfo } from './types';

export interface ExpoReleaseOptions {
  /** Platform to build for. Defaults to 'ios' */
  platform?: 'ios' | 'android' | 'all';
  /** Whether to submit to app stores after building */
  submit?: boolean;
  /** Whether to wait for the build to complete (default: false, uses --no-wait) */
  wait?: boolean;
}

/**
 * Publish Expo app via EAS Build and optionally submit to app stores
 *
 * Requires environment variables:
 * - EXPO_TOKEN: Expo access token for EAS
 *
 * Apple credentials are configured in eas.json submit configuration
 */
export async function publishExpoApp(
  pkg: PackageInfo,
  _version: string,
  dryRun: boolean,
  options: ExpoReleaseOptions = {},
): Promise<void> {
  const { platform = 'ios', submit = true, wait = false } = options;

  if (dryRun) {
    console.log(
      `🏃 [DRY RUN] Would build ${pkg.name} for ${platform} and ${submit ? 'submit to stores' : 'skip submission'}`,
    );
    return;
  }

  const expoToken = process.env.EXPO_TOKEN;

  if (!expoToken) {
    throw new Error(
      'EXPO_TOKEN environment variable is required for Expo publishing',
    );
  }

  // Build the app using EAS Build
  console.log(`📦 Building ${pkg.name} for ${platform}...`);

  const buildArgs = [
    'build',
    '--platform',
    platform,
    '--profile',
    'production',
    '--non-interactive',
  ];

  if (!wait) {
    buildArgs.push('--no-wait');
  }

  await $`cd ${pkg.path} && eas ${buildArgs}`.env({
    ...process.env,
    EXPO_TOKEN: expoToken,
  });

  console.log(`✅ EAS Build started for ${platform}`);

  // Submit to app stores if requested
  if (submit) {
    console.log(`📤 Submitting ${pkg.name} to app stores...`);

    // For submission, we need the build to complete first if we didn't wait
    // EAS submit will use the latest build if no build ID is specified
    const submitArgs = [
      'submit',
      '--platform',
      platform,
      '--profile',
      'production',
      '--non-interactive',
      '--latest',
    ];

    if (!wait) {
      // If we didn't wait for build, submission will be queued
      console.log('📋 Submission will use the latest completed build');
    }

    await $`cd ${pkg.path} && eas ${submitArgs}`.env({
      ...process.env,
      EXPO_TOKEN: expoToken,
    });

    console.log(
      `✅ Submitted to ${platform === 'ios' ? 'App Store Connect' : platform === 'android' ? 'Google Play' : 'app stores'}`,
    );
  }
}

/**
 * Update the version in app.config.ts
 * This updates the hardcoded version string in the Expo app config
 */
export async function updateExpoVersion(
  pkg: PackageInfo,
  newVersion: string,
): Promise<void> {
  const appConfigPath = `${pkg.path}/app.config.ts`;

  // Read the current app.config.ts
  const content = await Bun.file(appConfigPath).text();

  // Replace the version field
  const updatedContent = content.replace(
    /version:\s*['"][\d.]+['"]/,
    `version: '${newVersion}'`,
  );

  // Write back
  await Bun.write(appConfigPath, updatedContent);

  console.log(`📝 Updated ${appConfigPath} to version ${newVersion}`);
}
