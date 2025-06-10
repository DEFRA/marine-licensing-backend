export default {
  rootDir: '.',
  verbose: true,
  resetModules: true,
  clearMocks: true,
  silent: false,
  testEnvironment: 'node',
  setupFiles: [],
  setupFilesAfterEnv: [],
  transform: {
    '^.+\\.js$': 'babel-jest'
  }
}
