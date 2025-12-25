import type { Config } from 'drizzle-kit';

import { env } from './src/env';

const nonPoolingUrl = (env.POSTGRES_URL ?? '').replace(':6543', ':5432');

export default {
  dbCredentials: { url: nonPoolingUrl },
  dialect: 'postgresql',
  migrations: {
    schema: 'startup_template', // Store migrations table in our schema
    table: '__drizzle_migrations',
  },
  out: './drizzle',
  schema: './src/schema/*.ts',
  schemaFilter: ['startup_template'], // Only manage tables in this schema
} satisfies Config;
