import baseConfig from '@acme/next-config/base';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...baseConfig,
  transpilePackages: [
    '@acme/analytics',
    '@acme/api',
    '@acme/db',
    '@acme/id',
    '@acme/ui',
    '@acme/logger',
    '@acme/stripe',
  ],
};

export default nextConfig;
