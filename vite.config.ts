import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages path for github.com/vasilismavratsas/Body
  base: '/Body/',
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Durable CI fix for vitest-worker "Timeout calling onTaskUpdate":
    // one worker, no file parallelism, aggressive timeouts. Long Monte Carlo
    // golden work runs outside vitest via `npm run test:golden` (separate CI step).
    // Avoid singleFork: it shares one jsdom across files and breaks RTL queries.
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 600_000,
    hookTimeout: 300_000,
    teardownTimeout: 300_000,
    slowTestThreshold: 15_000,
    reporters: process.env.CI ? ['dot'] : ['default'],
  },
});
