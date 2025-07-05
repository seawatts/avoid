#!/usr/bin/env node
import { homedir } from 'node:os';
import { join } from 'node:path';
import { debug, defaultLogger } from '@acme/logger';
import { RollingFileDestination } from '@acme/logger/destinations/rolling-file';

const logDir = join(homedir(), '.acme');
defaultLogger.addDestination(
  new RollingFileDestination({
    filepath: join(logDir, 'acme.log'),
    createDirectory: true,
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    rotationInterval: 60 * 60 * 1000, // 1 hour
  }),
);

import { render } from 'ink';
import { Layout } from './app/layout';
import { parseArgs } from './lib/cli/args';
import { setupDebug } from './lib/cli/debug';
import { setupProcessHandlers } from './lib/cli/process';
import { capture, captureException, shutdown } from './lib/posthog';
import { useCliStore } from './stores/cli-store';

const log = debug('acme:cli');

async function main() {
  try {
    const args = await parseArgs();
    await setupDebug({ isDebugEnabled: args.verbose });
    useCliStore.setState(args);

    capture({
      event: 'cli_loaded',
      properties: {
        debug: args.verbose,
        version: args.version,
        command: args.command,
      },
    });

    setupProcessHandlers();

    log('Starting CLI', {
      debug: args.verbose,
      version: args.version,
      command: args.command,
    });

    const renderInstance = render(<Layout />, {
      debug: args.verbose,
    });

    log('Waiting for CLI to exit...');
    await renderInstance.waitUntilExit();
    log('Cleanup after CLI exit...');
    renderInstance.cleanup();
  } catch (error) {
    log('Global error:', error);
    try {
      captureException(error as Error);
    } catch (error) {
      log('Error capturing exception:', error);
    }
  } finally {
    log('Cleanup in finally...');
    await shutdown();
    setTimeout(() => {
      process.exit(1);
    }, 0);
  }
}

void main();
