import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ['@duckdb/node-api'],
  partialPrefetching: true,
  // The snapshot is read with fs at request time: ship it with every server function.
  outputFileTracingIncludes: { '/**': ['./data/snapshot/**/*'] },
  // Fire-map layers change only with a new deployment: let browsers and the CDN keep them.
  async headers() {
    return [
      {
        source: '/geo/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
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
