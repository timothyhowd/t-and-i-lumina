import type { NextConfig } from 'next';

const config: NextConfig = {
  // Allow importing JSON from the sibling corpus/ directory.
  experimental: {
    typedRoutes: true,
  },
  // Read corpus templates and mock-systems at server-side runtime.
  // Corpus lives outside app/ deliberately (it's the project's content store).
  outputFileTracingIncludes: {
    '/api/**/*': ['../corpus/**/*'],
  },
};

export default config;
