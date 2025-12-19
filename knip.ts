import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignore: ['**/drizzle.config.ts', '**/metro.config.js', '**/babel.config.js'],
  ignoreDependencies: ['cz-conventional-changelog'],
  ignoreExportsUsedInFile: true,
  ignoreWorkspaces: ['apps/expo'],
  rules: {
    dependencies: 'warn',
    enumMembers: 'warn',
  },
  workspaces: {
    '.': {
      entry: 'checkly.config.ts',
    },
    'apps/*': {
      entry: ['**/*.test.ts'],
      project: '**/*.ts',
    },
    'packages/*': {
      entry: ['**/*.test.ts'],
      project: '**/*.ts',
    },
  },
};

export default config;
