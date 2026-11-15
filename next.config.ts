import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ['@duckdb/node-api'],
  partialPrefetching: true,
  // The snapshot is read with fs at request time: ship it with every server function.
  outputFileTracingIncludes: { '/**': ['./data/snapshot/**/*'] },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
