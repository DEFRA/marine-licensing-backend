// Temporary Jest configuration for testing without MongoDB
module.exports = {
  rootDir: '.',
  verbose: true,
  resetModules: true,
  clearMocks: true,
  testMatch: ['**/src/common/helpers/auth/simple-defra-id.test.js'],
  collectCoverageFrom: ['src/common/helpers/auth/defra-id.js'],
  coverageDirectory: '<rootDir>/temp-coverage',
  transform: {
    '^.+\\.js$': 'babel-jest'
  }
}
