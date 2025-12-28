import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignore: [
    '**/drizzle.config.ts',
    '**/metro.config.js',
    '**/babel.config.js',
    './package.json',
  ],
  ignoreDependencies: [
    '@vercel/analytics',
    '@vercel/config',
    'lefthook',
    'expo-network',
    '@vercel/speed-insights',
    'react-dom',
    '@better-auth/expo',
    'vitest',
    '@tailwindcss/typography',
    '@trpc/react-query',
    'tailwindcss',
    '@happy-dom/global-registrator',
    '@react-email/components',
    '@types/aws-lambda',
    '@vscode/test-electron',
    'cli-highlight',
    'figlet',
    'clipboardy',
    'chalk',
    'react-error-boundary',
    '@dnd-kit/core',
    '@dnd-kit/modifiers',
    '@dnd-kit/sortable',
    '@dnd-kit/utilities',
    '@hookform/resolvers',
    '@number-flow/react',
    '@commitlint/cli',
    '@tanstack/react-table',
  ],
  ignoreExportsUsedInFile: true,
  ignoreWorkspaces: [
    'apps/ios',
    'tooling/next',
    'tooling/commitlint',
    'tooling/typescript',
    'tooling/github',
    'tooling/npm',
  ],
  rules: {
    dependencies: 'warn',
    enumMembers: 'warn',
  },
  workspaces: {
    '.': {
      entry: 'checkly.config.ts',
    },
    'apps/*': {
      entry: ['src/**/*.ts', 'src/**/*.tsx'],
      project: ['src/**/*.ts', 'src/**/*.tsx'],
    },
    'packages/*': {
      entry: ['src/**/*.ts', 'src/**/*.tsx'],
      project: ['src/**/*.ts', 'src/**/*.tsx'],
    },
    'packages/integ-test': {
      entry: ['src/**/*.ts', 'test-utils/**/*.ts', 'vitest.config.ts'],
      project: ['src/**/*.ts', 'test-utils/**/*.ts'],
    },
    'tooling/testing': {
      entry: ['src/**/*.ts'],
      project: ['src/**/*.ts'],
    },
  },
};

export default config;
