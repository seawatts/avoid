import type { InfisicalConfig, TomlConfig } from './types';

export async function readInfisicalConfig(): Promise<InfisicalConfig> {
  const configPath = '.infisical.json';
  const file = Bun.file(configPath);

  if (!(await file.exists())) {
    throw new Error(
      `.infisical.json not found. Please run 'infisical init' first.`,
    );
  }

  return JSON.parse(await file.text()) as InfisicalConfig;
}

export async function updateInfisicalConfig(
  workspaceId: string,
): Promise<void> {
  const config = await readInfisicalConfig();
  config.workspaceId = workspaceId;

  await Bun.write('.infisical.json', `${JSON.stringify(config, null, 2)}\n`);
}

export async function readSupabaseConfig(): Promise<TomlConfig> {
  const configPath = 'packages/db/supabase/config.toml';
  const file = Bun.file(configPath);

  if (!(await file.exists())) {
    throw new Error(`Supabase config not found at ${configPath}`);
  }

  const content = await file.text();
  return Bun.TOML.parse(content) as TomlConfig;
}
