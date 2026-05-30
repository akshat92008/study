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
      '@': path.resolve(__dirname),
      'server-only': path.resolve(__dirname, 'tests/shims/server-only.ts'),
    },
  },
});
