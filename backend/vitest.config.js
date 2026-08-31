import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 'forks' pool is required for mongodb-memory-server: it spawns a real
    // mongod process, which doesn't survive in worker threads.
    pool: 'forks',
    // Give each test file its own isolated module registry so vi.mock() calls
    // in one file don't bleed into another.
    isolate: true,
    // Increase timeout for mongodb-memory-server first-download (CI only hits
    // this once; subsequent runs use the cached binary).
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Print a short diff for every failed assertion
    reporters: ['verbose'],
    // Collect coverage from source files
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/seed.js', 'src/scripts/**'],
    },
  },
})
