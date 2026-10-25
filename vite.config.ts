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
    // Golden criterion (~60s) can trip the default worker RPC heartbeat on CI
    // runners ("Timeout calling onTaskUpdate") even when all tests pass.
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 600_000,
    hookTimeout: 120_000,
    teardownTimeout: 120_000,
    reporters: process.env.CI ? ['dot'] : ['default'],
  },
});
