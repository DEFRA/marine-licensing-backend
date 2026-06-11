import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    // Server-startup beforeAll hooks take 10-20s when all workers run in
    // parallel; the 10s default intermittently fails whole suites.
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [...configDefaults.exclude, 'coverage', 'src/index.js']
    },
    setupFiles: ['.vite/mongo-memory-server.js', '.vite/setup-files.js']
  }
})
