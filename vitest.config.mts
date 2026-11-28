import { defineConfig } from 'vitest/config';

// The full suite runs many Angular components in parallel workers. Under that load the first render
// of a component can exceed Vitest's 5 s default, which made unrelated specs fail intermittently.
// A generous per-test budget removes that noise without hiding real hangs.
export default defineConfig({
  test: {
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
