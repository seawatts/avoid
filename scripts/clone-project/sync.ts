/**
 * Sync Service Module
 *
 * Orchestrates fetching secrets from various services and syncing them to Infisical.
 */

import { readSupabaseConfig } from './config';
import { importInfisicalSecrets } from './infisical';
import { getPostHogProjectSecrets, selectPostHogProject } from './posthog';
import { getSupabaseProjectSecrets, selectSupabaseProject } from './supabase';
import {
  ENVIRONMENTS,
  type Environment,
  type FetchedSecrets,
  type PostHogRegion,
  SERVICE_MANUAL_SECRETS,
  type SyncService,
} from './types';
import { p, withSpinner } from './utils';

// ============================================================================
// Types
// ============================================================================

export interface SyncOptions {
  /** Target Infisical project ID */
  targetProjectId: string;
  /** Services to sync */
  services: SyncService[];
  /** PostHog API key (required if syncing PostHog) */
  posthogApiKey?: string;
  /** PostHog region */
  posthogRegion?: PostHogRegion;
  /** Skip interactive prompts */
  noInteractive?: boolean;
  /** Preview changes without applying */
  dryRun?: boolean;
}

export interface SyncResult {
  service: SyncService;
  secretsUpdated: number;
  environments: Environment[];
}

// ============================================================================
// Prompt for Manual Secrets
// ============================================================================

/**
 * Prompt user for secrets that cannot be auto-fetched
 */
export async function promptForManualSecrets(
  service: SyncService,
): Promise<Record<string, string>> {
  const manualSecrets = SERVICE_MANUAL_SECRETS[service];
  const secrets: Record<string, string> = {};

  for (const { key, hint } of manualSecrets) {
    const value = await p.text({
      message: `Enter ${key}:`,
      placeholder: hint || `Enter value for ${key}`,
      validate: (v) => {
        if (!v?.trim()) return `${key} is required`;
      },
    });

    if (p.isCancel(value)) {
      throw new Error('Cancelled by user');
    }

    secrets[key] = value as string;
  }

  return secrets;
}

// ============================================================================
// Service-Specific Sync Functions
// ============================================================================

/**
 * Sync Supabase secrets
 */
export async function syncSupabase(
  noInteractive?: boolean,
): Promise<FetchedSecrets> {
  // Select project
  const project = await selectSupabaseProject(noInteractive);

  // Prompt for DB password
  const dbPassword = await p.text({
    message: 'Enter the database password for this project:',
    placeholder: 'The password used when the project was created',
    validate: (v) => {
      if (!v?.trim()) return 'Database password is required';
    },
  });

  if (p.isCancel(dbPassword)) {
    throw new Error('Cancelled by user');
  }

  // Get local ports from supabase config
  let localApiPort = 54321;
  let localDbPort = 54322;
  try {
    const supabaseConfig = await readSupabaseConfig();
    localApiPort = supabaseConfig.api.port;
    localDbPort = supabaseConfig.db.port;
  } catch {
    // Use defaults
  }

  // Fetch secrets
  const secrets = await withSpinner(
    'Fetching Supabase credentials...',
    () =>
      getSupabaseProjectSecrets(
        project,
        dbPassword as string,
        localApiPort,
        localDbPort,
      ),
    `Fetched credentials for ${project.name}`,
  );

  return {
    dev: secrets.dev,
    production: secrets.production,
    service: 'supabase',
  };
}

/**
 * Sync PostHog secrets
 */
export async function syncPostHog(
  personalApiKey: string,
  region: PostHogRegion,
  noInteractive?: boolean,
): Promise<FetchedSecrets> {
  // Select project
  const { project } = await selectPostHogProject(
    personalApiKey,
    region,
    noInteractive,
  );

  // Get secrets
  const secrets = getPostHogProjectSecrets(project, region);

  // Also include the personal API key
  const allSecrets = {
    ...secrets.secrets,
    POSTHOG_PERSONAL_API_KEY: personalApiKey,
  };

  return {
    dev: allSecrets,
    production: allSecrets,
    service: 'posthog',
  };
}

/**
 * Sync Vercel secrets (all manual)
 */
export async function syncVercel(): Promise<FetchedSecrets> {
  const secrets = await promptForManualSecrets('vercel');

  return {
    dev: secrets,
    production: secrets,
    service: 'vercel',
  };
}

// ============================================================================
// Main Sync Orchestration
// ============================================================================

/**
 * Fetch secrets for a single service
 */
export async function fetchServiceSecrets(
  service: SyncService,
  options: {
    posthogApiKey?: string;
    posthogRegion?: PostHogRegion;
    noInteractive?: boolean;
  },
): Promise<FetchedSecrets> {
  switch (service) {
    case 'supabase':
      return syncSupabase(options.noInteractive);

    case 'posthog':
      if (!options.posthogApiKey) {
        throw new Error(
          'PostHog personal API key is required to sync PostHog secrets',
        );
      }
      return syncPostHog(
        options.posthogApiKey,
        options.posthogRegion || 'us',
        options.noInteractive,
      );

    case 'vercel':
      return syncVercel();
  }
}

/**
 * Sync secrets from multiple services to Infisical
 */
export async function syncSecretsToInfisical(
  options: SyncOptions,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  // Collect all secrets per environment
  const secretsByEnv: Record<Environment, Record<string, string>> = {
    dev: {},
    prod: {},
    staging: {},
  };

  // Fetch secrets from each service
  for (const service of options.services) {
    p.log.step(`Syncing ${service}...`);

    try {
      const fetched = await fetchServiceSecrets(service, {
        noInteractive: options.noInteractive,
        posthogApiKey: options.posthogApiKey,
        posthogRegion: options.posthogRegion,
      });

      // Add to environment maps
      Object.assign(secretsByEnv.dev, fetched.dev);
      Object.assign(secretsByEnv.staging, fetched.production);
      Object.assign(secretsByEnv.prod, fetched.production);

      results.push({
        environments: [...ENVIRONMENTS],
        secretsUpdated: Object.keys(fetched.production).length,
        service,
      });
    } catch (error) {
      p.log.error(
        `Failed to sync ${service}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  // Import to Infisical
  if (options.dryRun) {
    p.log.info('Dry run - would import:');
    for (const env of ENVIRONMENTS) {
      p.log.info(`  ${env}: ${Object.keys(secretsByEnv[env]).length} secrets`);
    }
  } else {
    await withSpinner(
      'Importing secrets to Infisical...',
      async (update) => {
        for (const env of ENVIRONMENTS) {
          if (Object.keys(secretsByEnv[env]).length > 0) {
            update(`Importing to ${env}...`);
            await importInfisicalSecrets(
              options.targetProjectId,
              env,
              secretsByEnv[env],
            );
          }
        }
      },
      'Imported secrets to Infisical',
    );
  }

  return results;
}

// ============================================================================
// Summary Display
// ============================================================================

export function showSyncSummary(results: SyncResult[], dryRun?: boolean): void {
  if (results.length === 0) {
    p.note('No services were synced.', '📋 Summary');
    return;
  }

  const lines: string[] = [];

  if (dryRun) {
    lines.push('(Dry run - no changes made)\n');
  }

  for (const result of results) {
    lines.push(`✓ ${result.service}: ${result.secretsUpdated} secrets`);
  }

  p.note(lines.join('\n'), '📋 Sync Summary');
}
