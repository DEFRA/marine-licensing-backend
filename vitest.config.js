import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    // Files run concurrently. They share one mongod, so setup-files.js gives
    // each worker slot its own database to keep them from clobbering each other.
    fileParallelism: true,
    // MMS may download/extract mongod on cold CI caches; default 10s is too short
    hookTimeout: 60_000,
    // Running files concurrently saturates the CPU, so tests that boot a server
    // can exceed the 5s default while still being healthy. High enough to absorb
    // that contention, low enough to still catch a genuinely hung test.
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [...configDefaults.exclude, 'coverage', 'src/index.js']
    },
    globalSetup: ['.vite/mongo-memory-server.js'],
    setupFiles: ['.vite/setup-files.js']
  }
})
