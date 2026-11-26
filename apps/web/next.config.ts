import path from 'node:path';
import type { NextConfig } from 'next';

const monorepoRoot = path.resolve(process.cwd(), '../..');

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ['@solaris/solar-engine', '@solaris/validation'],
  turbopack: { root: monorepoRoot },
  outputFileTracingRoot: monorepoRoot,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
