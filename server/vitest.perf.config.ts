import { defineConfig } from 'vitest/config';

// Perf files run one at a time so their timings don't compete for CPU, and fixture
// generation in beforeAll gets the same budget as the tests themselves.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['perf/**/*.perf.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
