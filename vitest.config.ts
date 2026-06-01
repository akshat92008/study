import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', '__tests__/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'scratch', 'temp_neetapp'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
  resolve: {
    alias: {
      '@/planners': path.resolve(__dirname, 'lib/planners'),
      '@/services': path.resolve(__dirname, 'lib/services'),
      '@/alerts': path.resolve(__dirname, 'lib/alerts'),
      '@/db': path.resolve(__dirname, 'lib/db'),
      '@/engines': path.resolve(__dirname, 'lib/engines'),
      '@/graph': path.resolve(__dirname, 'lib/graph'),
      '@/queues': path.resolve(__dirname, 'lib/queues'),
      '@/telemetry': path.resolve(__dirname, 'lib/telemetry'),
      '@/workers': path.resolve(__dirname, 'lib/workers'),
      '@': path.resolve(__dirname),
      'server-only': path.resolve(__dirname, 'tests/shims/server-only.ts'),
    },
  },
});
