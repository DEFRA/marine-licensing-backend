import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    // threads: false was removed to allow parallel test workers (faster runs).
    // Integration tests that share the in-memory MongoDB instance are isolated
    // per-file, so parallel execution is safe. hookTimeout is raised because
    // server-startup beforeAll hooks can take 10-20s under parallel load,
    // which intermittently hit the 10s default and failed whole suites.
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
