import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    // threads: false removed — per-file MongoDB isolation makes parallel workers safe.
    // hookTimeout raised to 60s: server-startup beforeAll hooks can take 10-20s under parallel load.
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
