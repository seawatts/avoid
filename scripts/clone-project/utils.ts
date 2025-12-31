import { randomBytes } from 'node:crypto';

import * as p from '@clack/prompts';

// Global verbose flag
let verboseMode = false;

export function setVerbose(verbose: boolean) {
  verboseMode = verbose;
}

export function isVerbose(): boolean {
  return verboseMode;
}

export { p };

// ============================================================================
// Password Generation
// ============================================================================

export function generateSecurePassword(length = 32): string {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((byte) => charset[byte % charset.length])
    .join('');
}

// ============================================================================
// Command Execution
// ============================================================================

export async function runCommand(
  command: string[],
  options: { silent?: boolean } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (verboseMode) {
    p.log.step(`Running: ${command.join(' ')}`);
  }

  const proc = Bun.spawn(command, {
    stderr: 'pipe',
    stdout: 'pipe',
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  if (verboseMode) {
    if (stdout.trim()) {
      p.log.info(`stdout: ${stdout.trim()}`);
    }
    if (stderr.trim()) {
      p.log.warn(`stderr: ${stderr.trim()}`);
    }
  }

  if (exitCode !== 0 && (verboseMode || !options.silent)) {
    p.log.error(`Command failed: ${command.join(' ')}`);
    if (stdout) p.log.info(`stdout: ${stdout}`);
    if (stderr) p.log.warn(`stderr: ${stderr}`);
  }

  return {
    exitCode,
    stderr,
    stdout,
  };
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Spinner Helper
// ============================================================================

/**
 * Execute an async operation with a spinner.
 * Automatically handles start, stop, and error states.
 */
export async function withSpinner<T>(
  message: string,
  fn: (updateMessage: (msg: string) => void) => Promise<T>,
  successMessage?: string,
): Promise<T> {
  const spinner = p.spinner();
  spinner.start(message);

  try {
    const result = await fn((msg) => spinner.message(msg));
    spinner.stop(successMessage ?? message.replace('...', ''));
    return result;
  } catch (error) {
    spinner.stop(message.replace('...', ' failed'));
    throw error;
  }
}

// ============================================================================
// API Fetch Helper
// ============================================================================

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Make an authenticated API request with consistent error handling.
 */
export async function apiFetch<T>(
  url: string,
  token: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const response = await fetch(url, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    method,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// Selection Helper
// ============================================================================

interface SelectOption<T> {
  label: string;
  value: T;
  hint?: string;
}

interface SelectOrCreateOptions<T, TCreate = T> {
  /** Items to select from */
  items: T[];
  /** Message to show in the selection prompt */
  message: string;
  /** Map item to option for display */
  mapOption: (item: T) => SelectOption<string>;
  /** Find item by provided ID */
  findById?: (items: T[], id: string) => T | undefined;
  /** Provided ID from CLI args */
  providedId?: string;
  /** Whether to skip prompts */
  noInteractive?: boolean;
  /** Whether this is a dry run */
  dryRun?: boolean;
  /** Label for "Create new" option */
  createLabel?: string;
  /** Handler for creating new item */
  onCreate?: () => Promise<TCreate>;
  /** Message to log when auto-selecting an item */
  autoSelectMessage?: (item: T) => string;
}

/**
 * Generic helper for "select from list or create new" patterns.
 * Handles provided IDs, single items, non-interactive mode, and prompts.
 */
export async function selectOrCreate<T, TCreate = T>(
  options: SelectOrCreateOptions<T, TCreate>,
): Promise<T | TCreate> {
  const {
    items,
    message,
    mapOption,
    findById,
    providedId,
    noInteractive,
    dryRun,
    createLabel,
    onCreate,
    autoSelectMessage,
  } = options;

  // If ID provided, find and return
  if (providedId && findById) {
    const item = findById(items, providedId);
    if (!item) {
      throw new Error(`Item with ID ${providedId} not found`);
    }
    if (autoSelectMessage) {
      p.log.success(autoSelectMessage(item));
    }
    return item;
  }

  // Single item - auto-select
  if (items.length === 1 && !onCreate) {
    const item = items[0];
    if (item) {
      if (autoSelectMessage) {
        p.log.success(autoSelectMessage(item));
      }
      return item;
    }
  }

  // Non-interactive mode - use first or fail
  if (noInteractive) {
    if (items.length === 0 && !onCreate) {
      throw new Error(
        'No items found and cannot create in non-interactive mode',
      );
    }
    const item = items[0];
    if (item) {
      if (autoSelectMessage) {
        p.log.success(autoSelectMessage(item));
      }
      return item;
    }
  }

  // Build select options
  const selectOptions: SelectOption<string>[] = [];

  // Add "Create new" option if handler provided and not dry-run
  if (onCreate && createLabel && !dryRun) {
    selectOptions.push({
      hint: 'Create a new one',
      label: createLabel,
      value: '__create_new__',
    });
  }

  // Add existing items
  selectOptions.push(...items.map(mapOption));

  if (selectOptions.length === 0) {
    throw new Error('No options available');
  }

  const selected = await p.select({
    message,
    options: selectOptions,
  });

  if (p.isCancel(selected)) {
    throw new Error('Cancelled by user');
  }

  if (selected === '__create_new__' && onCreate) {
    return onCreate();
  }

  const selectedItem = items.find((item) => mapOption(item).value === selected);
  if (!selectedItem) {
    throw new Error('Invalid selection');
  }

  return selectedItem;
}
