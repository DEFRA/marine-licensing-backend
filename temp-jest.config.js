// Temporary Jest configuration for testing without MongoDB
export default {
  testEnvironment: 'node',
  transform: {},
  coveragePathIgnorePatterns: ['node_modules', 'test', 'coverage'],
  collectCoverageFrom: ['src/**/*.js'],
  testMatch: [
    '**/src/common/helpers/logging/logger.test.js',
    '**/src/common/helpers/auth/defra-id.test.js',
    '**/src/common/helpers/proxy/setup-proxy.test.js'
  ]
}
