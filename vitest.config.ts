import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only`/`client-only` throw when resolved outside Next's RSC/browser
      // pipelines; stub them so server modules (e.g. tactics.ts) can be unit-tested.
      'server-only': path.resolve(__dirname, './src/test-stubs/empty.ts'),
      'client-only': path.resolve(__dirname, './src/test-stubs/empty.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
  },
});
