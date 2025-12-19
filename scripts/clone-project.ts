#!/usr/bin/env bun
/**
 * Clone Project Script
 *
 * Creates a new Supabase organization and project, then clones all Infisical
 * secrets from an existing project to a new one, updating environment-specific
 * values appropriately.
 *
 * Usage:
 *   bun scripts/clone-project.ts \
 *     --target-infisical-project <new-project-id> \
 *     --supabase-project-name <name> \
 *     --supabase-region <region>
 */

import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';

// Types
interface InfisicalConfig {
  workspaceId: string;
  defaultEnvironment?: string;
  gitBranchToEnvironmentMapping?: null | Record<string, string>;
}

interface Secret {
  key: string;
  value: string;
  workspace?: string;
  type?: string;
}

interface SupabaseApiKey {
  name: string;
  api_key: string;
}

interface SupabaseProject {
  id: string;
  name: string;
  region: string;
  organization_id: string;
}

interface SupabaseOrg {
  id: string;
  name: string;
}

interface TomlConfig {
  api: { port: number };
  db: { port: number };
  [key: string]: unknown;
}

// Constants
const ENVIRONMENTS = ['dev', 'staging', 'prod'] as const;
type Environment = (typeof ENVIRONMENTS)[number];

// Utility functions
function log(
  message: string,
  type: 'info' | 'success' | 'error' | 'wait' = 'info',
) {
  const prefix = {
    error: '✗',
    info: '  ',
    success: '✓',
    wait: '⏳',
  }[type];
  console.log(`${prefix} ${message}`);
}

function logSection(title: string) {
  console.log(`\n${title}`);
}

function generateSecurePassword(length = 32): string {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((byte) => charset[byte % charset.length])
    .join('');
}

async function runCommand(
  command: string[],
  options: { silent?: boolean } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(command, {
    stderr: 'pipe',
    stdout: 'pipe',
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (!options.silent && exitCode !== 0) {
    console.error(`Command failed: ${command.join(' ')}`);
    console.error(stderr);
  }

  return { exitCode, stderr, stdout };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Infisical operations
async function exportInfisicalSecrets(
  projectId: string,
  env: Environment,
): Promise<Secret[]> {
  const { stdout, exitCode } = await runCommand([
    'infisical',
    'export',
    `--env=${env}`,
    `--projectId=${projectId}`,
    '--format=json',
    '--silent',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Failed to export secrets for ${env} environment`);
  }

  return JSON.parse(stdout) as Secret[];
}

async function importInfisicalSecrets(
  projectId: string,
  env: Environment,
  secrets: Record<string, string>,
): Promise<void> {
  // Import secrets in batches to avoid command line length limits
  const entries = Object.entries(secrets);
  const batchSize = 10;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const secretArgs = batch.map(([key, value]) => `${key}=${value}`);

    const { exitCode, stderr } = await runCommand([
      'infisical',
      'secrets',
      'set',
      `--env=${env}`,
      `--projectId=${projectId}`,
      ...secretArgs,
    ]);

    if (exitCode !== 0) {
      throw new Error(
        `Failed to import secrets for ${env} environment: ${stderr}`,
      );
    }
  }
}

// Supabase operations
async function listSupabaseOrgs(): Promise<SupabaseOrg[]> {
  const { stdout, exitCode } = await runCommand([
    'bunx',
    'supabase',
    'orgs',
    'list',
    '-o',
    'json',
  ]);

  if (exitCode !== 0) {
    throw new Error('Failed to list Supabase organizations');
  }

  return JSON.parse(stdout) as SupabaseOrg[];
}

async function createSupabaseOrg(_name: string): Promise<SupabaseOrg> {
  // supabase orgs create is interactive, so we need to use a different approach
  // We'll prompt the user to create it manually or use an existing org
  const orgs = await listSupabaseOrgs();

  if (orgs.length > 0) {
    console.log('\nExisting Supabase organizations:');
    for (let i = 0; i < orgs.length; i++) {
      const org = orgs[i];
      console.log(`  ${i + 1}. ${org.name} (${org.id})`);
    }
    console.log('\nTo create a new org, run: bunx supabase orgs create');
    console.log('Then re-run this script with --supabase-org-id <org-id>\n');

    // For now, use the first org if only one exists
    if (orgs.length === 1) {
      log(`Using existing org: ${orgs[0].name} (${orgs[0].id})`, 'success');
      return orgs[0];
    }

    throw new Error(
      'Multiple organizations found. Please specify --supabase-org-id',
    );
  }

  throw new Error(
    'No Supabase organizations found. Please create one first with: bunx supabase orgs create',
  );
}

async function createSupabaseProject(
  name: string,
  orgId: string,
  dbPassword: string,
  region: string,
): Promise<SupabaseProject> {
  const { stdout, exitCode, stderr } = await runCommand([
    'bunx',
    'supabase',
    'projects',
    'create',
    name,
    '--org-id',
    orgId,
    '--db-password',
    dbPassword,
    '--region',
    region,
    '-o',
    'json',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Failed to create Supabase project: ${stderr}`);
  }

  return JSON.parse(stdout) as SupabaseProject;
}

async function waitForProjectReady(
  projectRef: string,
  maxAttempts = 30,
  intervalMs = 10000,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { stdout, exitCode } = await runCommand(
      ['bunx', 'supabase', 'projects', 'list', '-o', 'json'],
      { silent: true },
    );

    if (exitCode === 0) {
      const projects = JSON.parse(stdout) as Array<{
        id: string;
        status: string;
      }>;
      const project = projects.find((p) => p.id === projectRef);

      if (project && project.status === 'ACTIVE_HEALTHY') {
        return;
      }
    }

    if (attempt < maxAttempts - 1) {
      process.stdout.write('.');
      await sleep(intervalMs);
    }
  }

  throw new Error('Timed out waiting for project to be ready');
}

async function getSupabaseApiKeys(
  projectRef: string,
): Promise<SupabaseApiKey[]> {
  const { stdout, exitCode, stderr } = await runCommand([
    'bunx',
    'supabase',
    'projects',
    'api-keys',
    '--project-ref',
    projectRef,
    '-o',
    'json',
  ]);

  if (exitCode !== 0) {
    throw new Error(`Failed to get API keys: ${stderr}`);
  }

  return JSON.parse(stdout) as SupabaseApiKey[];
}

// Config file operations
async function readInfisicalConfig(): Promise<InfisicalConfig> {
  const configPath = '.infisical.json';
  const file = Bun.file(configPath);

  if (!(await file.exists())) {
    throw new Error(
      `.infisical.json not found. Please run 'infisical init' first.`,
    );
  }

  return JSON.parse(await file.text()) as InfisicalConfig;
}

async function updateInfisicalConfig(workspaceId: string): Promise<void> {
  const config = await readInfisicalConfig();
  config.workspaceId = workspaceId;

  await Bun.write('.infisical.json', `${JSON.stringify(config, null, 2)}\n`);
}

async function readSupabaseConfig(): Promise<TomlConfig> {
  const configPath = 'packages/db/supabase/config.toml';
  const file = Bun.file(configPath);

  if (!(await file.exists())) {
    throw new Error(`Supabase config not found at ${configPath}`);
  }

  const content = await file.text();
  return Bun.TOML.parse(content) as TomlConfig;
}

// Build override objects
function buildLocalDevOverrides(
  apiPort: number,
  dbPort: number,
): Record<string, string> {
  return {
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${apiPort}`,
    POSTGRES_DATABASE: 'postgres',
    POSTGRES_PASSWORD: 'postgres',
    POSTGRES_URL: `postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres`,
    SUPABASE_ANON_KEY:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    SUPABASE_JWT_SECRET:
      'super-secret-jwt-token-with-at-least-32-characters-long',
    SUPABASE_SERVICE_ROLE_KEY:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
    SUPABASE_URL: `http://127.0.0.1:${apiPort}`,
  };
}

function buildSupabaseCredentials(
  projectRef: string,
  region: string,
  dbPassword: string,
  apiKeys: SupabaseApiKey[],
): Record<string, string> {
  const anonKey = apiKeys.find((k) => k.name === 'anon')?.api_key;
  const serviceRoleKey = apiKeys.find(
    (k) => k.name === 'service_role',
  )?.api_key;

  if (!anonKey || !serviceRoleKey) {
    throw new Error('Could not find required API keys');
  }

  return {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    POSTGRES_PASSWORD: dbPassword,
    POSTGRES_URL: `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
    SUPABASE_ANON_KEY: anonKey,
    SUPABASE_PROJECT_ID: projectRef,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    SUPABASE_URL: `https://${projectRef}.supabase.co`,
  };
}

// Main function
async function main() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      'dry-run': { default: false, type: 'boolean' },
      help: { default: false, type: 'boolean' },
      'supabase-org-id': { type: 'string' },
      'supabase-org-name': { type: 'string' },
      'supabase-project-name': { type: 'string' },
      'supabase-region': { type: 'string' },
      'target-infisical-project': { type: 'string' },
    },
  });

  if (values.help) {
    console.log(`
Clone Project Script

Creates a new Supabase org/project and clones Infisical secrets.

Usage:
  bun scripts/clone-project.ts [options]

Required Options:
  --target-infisical-project <id>   New Infisical project ID
  --supabase-project-name <name>    Name for the new Supabase project
  --supabase-region <region>        Supabase region (e.g., us-west-1)

Optional:
  --supabase-org-id <id>            Use existing Supabase org
  --supabase-org-name <name>        Name for new Supabase org
  --dry-run                         Preview changes without applying
  --help                            Show this help message
`);
    process.exit(0);
  }

  const targetInfisicalProject = values['target-infisical-project'];
  const supabaseProjectName = values['supabase-project-name'];
  const supabaseRegion = values['supabase-region'];
  const supabaseOrgId = values['supabase-org-id'];
  const dryRun = values['dry-run'];

  // Validate required arguments
  if (!targetInfisicalProject) {
    console.error('Error: --target-infisical-project is required');
    process.exit(1);
  }
  if (!supabaseProjectName) {
    console.error('Error: --supabase-project-name is required');
    process.exit(1);
  }
  if (!supabaseRegion) {
    console.error('Error: --supabase-region is required');
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }

  try {
    // Step 1: Read source project from .infisical.json
    logSection('Reading source project from .infisical.json...');
    const infisicalConfig = await readInfisicalConfig();
    const sourceProjectId = infisicalConfig.workspaceId;
    log(`Source project: ${sourceProjectId}`, 'success');

    // Step 2: Generate secure database password
    logSection('Generating secure database password...');
    const dbPassword = generateSecurePassword(32);
    log('Generated 32-character password', 'success');

    // Step 3: Get or create Supabase organization
    logSection('Setting up Supabase organization...');
    let orgId = supabaseOrgId;

    if (!orgId) {
      const org = await createSupabaseOrg(values['supabase-org-name'] || '');
      orgId = org.id;
    } else {
      log(`Using provided org ID: ${orgId}`, 'success');
    }

    // Step 4: Create Supabase project
    logSection('Creating Supabase project...');
    let projectRef: string;

    if (dryRun) {
      log(`Would create project: ${supabaseProjectName}`, 'info');
      log(`  Region: ${supabaseRegion}`, 'info');
      log(`  Org ID: ${orgId}`, 'info');
      projectRef = 'dry-run-project-ref';
    } else {
      const project = await createSupabaseProject(
        supabaseProjectName,
        orgId,
        dbPassword,
        supabaseRegion,
      );
      projectRef = project.id;
      log(
        `Created project: ${supabaseProjectName} (ref: ${projectRef})`,
        'success',
      );

      // Step 5: Wait for project to be ready
      log('Waiting for project to be ready...', 'wait');
      await waitForProjectReady(projectRef);
      console.log();
      log('Project ready!', 'success');
    }

    // Step 6: Get Supabase API keys
    logSection('Fetching Supabase API keys...');
    let apiKeys: SupabaseApiKey[] = [];

    if (dryRun) {
      log('Would fetch API keys', 'info');
      apiKeys = [
        { api_key: 'dry-run-anon-key', name: 'anon' },
        { api_key: 'dry-run-service-role-key', name: 'service_role' },
      ];
    } else {
      apiKeys = await getSupabaseApiKeys(projectRef);
      log('Retrieved anon key and service role key', 'success');
    }

    // Step 7: Read Supabase config for local ports
    logSection('Reading local Supabase config...');
    const supabaseConfig = await readSupabaseConfig();
    const apiPort = supabaseConfig.api.port;
    const dbPort = supabaseConfig.db.port;
    log(`API port: ${apiPort}, DB port: ${dbPort}`, 'success');

    // Step 8: Build override objects
    const localDevOverrides = buildLocalDevOverrides(apiPort, dbPort);
    const supabaseCreds = buildSupabaseCredentials(
      projectRef,
      supabaseRegion,
      dbPassword,
      apiKeys,
    );

    // Step 9: Export secrets from source project
    logSection('Exporting secrets from source Infisical project...');
    const secretsByEnv: Record<Environment, Record<string, string>> = {
      dev: {},
      prod: {},
      staging: {},
    };

    for (const env of ENVIRONMENTS) {
      const secrets = await exportInfisicalSecrets(sourceProjectId, env);
      secretsByEnv[env] = Object.fromEntries(
        secrets.map((s) => [s.key, s.value]),
      );
      log(`Exported ${secrets.length} secrets from ${env}`, 'success');
    }

    // Step 10: Apply updates
    logSection('Applying updates...');

    // Dev gets local overrides
    Object.assign(secretsByEnv.dev, localDevOverrides);
    log(
      `Applied local dev overrides (${Object.keys(localDevOverrides).length} variables)`,
      'success',
    );

    // Staging and prod get Supabase credentials
    Object.assign(secretsByEnv.staging, supabaseCreds);
    log(
      `Applied Supabase creds to staging (${Object.keys(supabaseCreds).length} variables including POSTGRES_PASSWORD)`,
      'success',
    );

    Object.assign(secretsByEnv.prod, supabaseCreds);
    log(
      `Applied Supabase creds to prod (${Object.keys(supabaseCreds).length} variables including POSTGRES_PASSWORD)`,
      'success',
    );

    // Step 11: Import secrets to new project
    logSection('Importing to new Infisical project...');

    if (dryRun) {
      for (const env of ENVIRONMENTS) {
        log(
          `Would import ${Object.keys(secretsByEnv[env]).length} secrets to ${env}`,
          'info',
        );
      }
    } else {
      for (const env of ENVIRONMENTS) {
        await importInfisicalSecrets(
          targetInfisicalProject,
          env,
          secretsByEnv[env],
        );
        log(
          `Imported ${Object.keys(secretsByEnv[env]).length} secrets to ${env}`,
          'success',
        );
      }
    }

    // Step 12: Update .infisical.json
    logSection('Updating .infisical.json...');

    if (dryRun) {
      log(`Would update workspaceId to: ${targetInfisicalProject}`, 'info');
    } else {
      await updateInfisicalConfig(targetInfisicalProject);
      log(`Updated workspaceId to: ${targetInfisicalProject}`, 'success');
    }

    // Done!
    console.log('\n✅ Done! Your new project is ready.');
    console.log(
      'Note: Database password has been securely stored in Infisical (POSTGRES_PASSWORD)',
    );

    if (!dryRun) {
      console.log(
        `\nNew Supabase project: https://supabase.com/dashboard/project/${projectRef}`,
      );
    }
  } catch (error) {
    console.error(
      '\n❌ Error:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

main();
