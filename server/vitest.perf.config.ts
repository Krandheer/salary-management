import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['perf/**/*.perf.test.ts'], testTimeout: 60_000 },
});
