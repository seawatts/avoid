import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignore: ['./package.json'],
  ignoreExportsUsedInFile: true,
  ignoreWorkspaces: [
    'tooling/commitlint',
    'tooling/typescript',
    'tooling/npm',
  ],
  rules: {
    dependencies: 'warn',
    enumMembers: 'warn',
  },
  workspaces: {
    'apps/*': {
      entry: ['**/*.ts?(x)'],
      project: ['**/*.ts?(x)'],
    },
    'packages/*': {
      entry: ['**/*.ts?(x)'],
      project: ['**/*.ts?(x)'],
    },
    'tooling/testing': {
      entry: ['**/*.ts?(x)'],
      project: ['**/*.ts?(x)'],
    },
  },
};

export default config;
