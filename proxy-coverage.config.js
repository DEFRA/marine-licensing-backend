// Configuration for measuring proxy directory coverage
export default {
  rootDir: '.',
  verbose: true,
  clearMocks: true,
  collectCoverageFrom: [
    'src/common/helpers/proxy/*.js',
    '!src/common/helpers/proxy/*.test.js',
    '!src/common/helpers/proxy/*.test-version.js',
    '!src/common/helpers/proxy/*.bak'
  ],
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
