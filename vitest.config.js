import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    // Test files run one at a time; they share a single mongod and the same
    // database name, so concurrent files would clobber each other's fixtures.
    fileParallelism: false,
    maxWorkers: 1,
    // MMS may download/extract mongod on cold CI caches; default 10s is too short
    hookTimeout: 60_000,
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
