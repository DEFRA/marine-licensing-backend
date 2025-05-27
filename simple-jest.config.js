// Simple Jest configuration for testing tls-error.js
export default {
  rootDir: '.',
  verbose: true,
  resetModules: true,
  clearMocks: true,
  collectCoverageFrom: ['src/common/helpers/proxy/tls-error.js'],
  coveragePathIgnorePatterns: ['<rootDir>/node_modules/'],
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  transformIgnorePatterns: ['/node_modules/'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '(.+)\\.js': '$1'
  }
}
